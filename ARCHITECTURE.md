# FormLab Architecture

FormLab is a modern web application for generating and manipulating digital fashion models and garments using Generative AI. It leverages a serverless architecture powered by Firebase and Google's Gemini API.

## Technology Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS
-   **Backend / Serverless**: Firebase Cloud Functions (Node.js), Firebase Authentication, Firestore, Firebase Storage
-   **AI / ML**: Google Gemini API (Multimodal capability), `@imgly/background-removal` (Client-side segmentation), Real-ESRGAN (Python backend for upscaling - optional)

## System Architecture

### High-Level Overview

FormLab follows a specific "Secure Proxy" pattern to handle AI interactions securely:

1.  **Frontend (Client)**:
    -   Handles user inputs (images, text prompts, settings).
    -   Performs initial client-side processing (e.g., resizing, basic background removal).
    -   Constructs complex prompts and prepares data.
    -   **NEVER** calls the Gemini API directly.
    -   Invokes Firebase Cloud Functions via `httpsCallable`.

2.  **Firebase Cloud Functions (Secure Gateway)**:
    -   Acts as a secure proxy between the client and the Gemini API.
    -   **Authentication**: Verifies user identity via Firebase Auth context.
    -   **Rate Limiting**: Enforces limits to prevent abuse.
    -   **Secrets Management**: securely stores `GEMINI_API_KEY` in Firebase Functions configuration (`functions.config().gemini.key`).
    -   Proxies the request to Google Gemini API and returns the result (text/JSON) to the client.

3.  **Data Storage (Firebase)**:
    -   **Firestore**: Stores user metadata, project settings, model history, and gallery items.
    -   **Storage**: Stores raw images (user uploads), generated assets, and intermediate blobs.

### Key Components

#### 1. Services (`/services`)

-   **`geminiService.ts`**: The core service for AI operations. It mirrors the Cloud Functions API, providing typed functions like `generateModelImage`, `generateVirtualTryOn`, etc. It handles adapting the Cloud Function response into a consistent format for the UI.
-   **`garmentExtractor.ts`**: Handles garment analysis and extraction. It combines client-side background removal (using WebAssembly) with server-side semantic analysis via Cloud Functions.
-   **`firebase.ts`**: Initializes the Firebase app and exports service instances (Auth, Firestore, Storage, Functions). Do NOT import `app` as a named export; use default export.

#### 2. Cloud Functions (`/functions`)

The backend logic is centralized here to protect API keys. Key functions include:
-   **`generateModelImage`**: Text-to-image and Image-to-image generation for base models.
-   **`generateVirtualTryOn`**: Multimodal generation combining model + garment + prompt.
-   **`analyzeGarment`**: Visual analysis of garment images to extract metadata (materials, style).
-   **`enhancePrompt`**: Text-based prompt engineering helper.

### Security Implementation

-   **API Keys**: The `GEMINI_API_KEY` is **never** exposed to the client. It is set in the Firebase environment:
    ```bash
    firebase functions:config:set gemini.key="YOUR_KEY"
    ```
-   **Client Injection**: Previous patterns injecting `process.env.API_KEY` into Vite have been **removed**.
-   **App Check**: (Recommended) Enable Firebase App Check to further restrict access to authorized apps only.

## Directory Structure

-   `/src`: Frontend source code.
    -   `/services`: API integration and logic.
    -   `/components`: UI components.
    -   `/types.ts`: Shared type definitions.
-   `/functions`: Backend Cloud Functions code.
    -   `/src/index.ts`: Entry point for all serverless functions.
