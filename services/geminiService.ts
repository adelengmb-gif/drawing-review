import { GoogleGenAI, Type } from "@google/genai";
import { AiDetectionResult } from "../types";

// --- Desensitization Prompt ---
const DESENSITIZATION_SYSTEM_INSTRUCTION = `
You are an expert in securing technical drawings and engineering blueprints. 
Your task is to identify sensitive information areas that need to be redacted (masked).
Target areas include:
1. Title Blocks (containing company names, client names, project addresses).
2. Specific personnel names or signatures.
3. Phone numbers, email addresses.
4. Financial figures or cost estimates.

Return a JSON array of objects where each object contains:
- "label": A short string describing what was found in Simplified Chinese.
- "box_2d": An array of 4 integers [ymin, xmin, ymax, xmax] representing the bounding box, normalized to a 0-1000 scale.
`;

// --- Audit Prompt Generator ---
const getAuditSystemInstruction = (requirements?: string) => `
# Role
资深 DFM (面向制造设计) 审核工程师

# Task
你将接收一张机械加工图纸（图片格式）。你的任务是进行“完整性预审”并结合“项目需求”进行核对。

${requirements ? `
# 📋 Project Requirements (项目需求 - 重点核对)
用户已明确以下订单要求，请重点检查图纸是否与此冲突：
"""
${requirements}
"""
**核对逻辑:**
1. **数量:** 如果需求是量产(如100套)，但图纸未标注或标注为打样，需预警。
2. **材质:** 如果需求指定材质(如 AL6061)，图纸上必须一致，否则报错。
` : ''}

# 🛡️ Privacy Shield (隐私防线 - 必须执行)
在输出报告时，**严禁** 提取或显示图纸上的以下敏感信息：
- 客户公司名称 / Logo
- 客户联系人姓名 / 电话 / 邮箱
- 项目具体代号
如果图纸上包含这些信息，请在提取时直接忽略或用 \`[敏感信息已屏蔽]\` 代替。

# 🔍 Audit Rules (通用审核规则)
1. **基础信息:** 是否有零件名称、图号？
2. **材质 (Material):** 是否明确标注了具体材料牌号？
3. **数量 (Quantity):** 是否标注了加工数量？
4. **尺寸与公差:** 是否有关键尺寸和公差？
5. **表面处理:** 是否有粗糙度或表处要求？

# Output Format (请严格输出 Markdown 表格)
| 审核项 | 状态 | 提取内容 / 问题描述 |
| :--- | :--- | :--- |
| **1. 材质** | ✅ 匹配 | 图纸标注 AL6061，与需求一致 |
| **2. 数量** | ⚠️ 冲突 | 需求 100 套，但图纸未标注数量，需确认 |
| **3. 公差** | ❓ 风险 | 仅有基本尺寸，未见公差标注 |
| **4. 表处** | ✅ 完整 | 黑色阳极氧化 |

**💡 专家建议:**
(基于上述缺失项或与需求的冲突点，生成一段简短、专业的建议。如果有冲突，请明确指出。)
`;

// --- Services ---

export const detectSensitiveData = async (base64Image: string): Promise<AiDetectionResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("缺少 API Key。请检查您的配置。");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Robustly extract base64 data regardless of MIME type prefix
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "分析这张技术图纸并检测敏感文本块或标题区域。" },
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
        ],
      },
      config: {
        systemInstruction: DESENSITIZATION_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              box_2d: { 
                type: Type.ARRAY,
                items: { type: Type.INTEGER } 
              }
            },
            required: ["label", "box_2d"]
          }
        }
      }
    });

    const jsonStr = response.text || "[]";
    return JSON.parse(jsonStr) as AiDetectionResult[];
  } catch (error) {
    console.error("Gemini Detection Error:", error);
    throw error;
  }
};

export const auditBlueprint = async (base64Image: string, requirements?: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("缺少 API Key。请检查您的配置。");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Robustly extract base64 data regardless of MIME type prefix
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: "请按照 DFM 专家的角色，对这张图纸进行完整性预审。" },
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
        ],
      },
      config: {
        systemInstruction: getAuditSystemInstruction(requirements),
        temperature: 0.4,
      }
    });

    return response.text || "AI 未返回结果，请重试。";
  } catch (error) {
    console.error("Gemini Audit Error:", error);
    throw error;
  }
};