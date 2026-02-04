import streamlit as st
import google.generativeai as genai
from PIL import Image
import os

# --- 1. 配置与安全 ---
st.set_page_config(page_title="海智图纸预审专家", layout="wide")

# 🔐 安全逻辑：优先从 Streamlit Cloud 的云端保险箱读取 Key
# 在本地运行时，你需要创建一个 .streamlit/secrets.toml 文件，或者直接在这里临时输入
try:
    if "GOOGLE_API_KEY" in st.secrets:
        api_key = st.secrets["GOOGLE_API_KEY"]
    else:
        # 如果没有配置 Secrets，在界面上给一个输入框（方便测试）
        api_key = st.sidebar.text_input("请输入 Google API Key", type="password")
        if not api_key:
            st.warning("⚠️ 请在侧边栏输入 API Key 或在后台配置 Secrets")
            st.stop()

    genai.configure(api_key=api_key)
    # 配置模型 (使用支持视觉的 Gemini 1.5 flash)
    model = genai.GenerativeModel('gemini-1.5-flash')

except Exception as e:
    st.error(f"配置失败: {e}")
    st.stop()

# --- 2. 界面标题 ---
st.title("📄 海智图纸秒级预审 Agent (MVP版)")
st.markdown("### 🤖 使用说明：直接上传图纸，AI 自动检测[材质]、[公差]等关键要素。")

# --- 3. 侧边栏：脱敏提示 ---
with st.sidebar:
    st.header("🛡️ 安全红线")
    st.warning("上传前请务必使用截图工具遮挡客户 Logo 和电话！")
    st.info("数据仅用于 AI 临时分析，不会留存。")

# --- 4. 核心功能区 ---
uploaded_file = st.file_uploader("请上传图纸 (支持 PNG, JPG, JPEG)", type=["png", "jpg", "jpeg"])

if uploaded_file is not None:
    # 展示图片
    image = Image.open(uploaded_file)
    st.image(image, caption='已上传图纸', use_column_width=True)
    
    # 按钮触发分析
    if st.button('🚀 开始 AI 预审'):
        with st.spinner('AI 工程师正在读图，请稍候 (约5-10秒)...'):
            try:
                # --- 5. 核心 Prompt (直接复用我们定义的 V1.1 版本) ---
                prompt = """
                Role: 资深 DFM 审核工程师
                Task: 分析图纸，提取关键要素。
                Output Format: 请直接输出 Markdown 表格，包含列：[审核项], [状态], [提取内容/问题]。
                关键审核项: 1.材质 2.数量 3.公差 4.表面处理。
                """
                
                # 调用 Gemini API
                response = model.generate_content([prompt, image])
                
                # --- 6. 结果展示 ---
                st.success("✅ 分析完成！")
                st.markdown("### 📋 预审报告")
                st.markdown(response.text)
                
                # 模拟回填 CRM 的 JSON 数据 (展示给老板看集成潜力)
                with st.expander("查看结构化数据 (供 CRM 集成用)"):
                    st.json({
                        "status": "success", 
                        "ai_engine": "gemini-1.5-flash",
                        "raw_output": response.text[:100] + "..."
                    })
                    
            except Exception as e:

                st.error(f"分析失败，请重试。错误信息: {e}")
