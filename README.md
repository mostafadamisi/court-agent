# Render All-in-One Deployment Guide 🚀

This folder is configured to host **both your Frontend and Backend** as a single project on Render.

## Deployment Steps

1. **GitHub**: Push the contents of *this* folder (`render_deploy/`) to a new repository.
2. **Render.com**:
   - Create a new **Web Service**.
   - Connect your GitHub repository.
3. **Configuration**:
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python backend/main.py`
4. **Environment Variables**:
   - Add `OPENAI_API_KEY`: `your_actual_key_here`

## How it works:
- Render will start the Python backend.
- The backend is programmed to serve the `frontend/` folder automatically.
- Your website and API will share the same URL!

---
**Note**: The system is pre-configured to automatically detect if it's running on your computer or on Render. No code changes are needed!
