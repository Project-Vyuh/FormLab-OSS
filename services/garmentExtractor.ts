import { getFunctions, httpsCallable } from "firebase/functions";
import { GarmentExtractionResult } from "../types";
import app from "./firebase"; // Ensure firebase app is initialized

const functions = getFunctions(app);

// Helper to convert file to base64
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Extract base64 part
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

import { removeBackground } from "@imgly/background-removal";

/**
 * Detect if the image contains a model wearing garments
 */
export async function detectModelInImage(imageFile: File): Promise<boolean> {
    try {
        const base64Data = await fileToBase64(imageFile);
        const mimeType = imageFile.type || "image/jpeg";

        const prompt = `Analyze this image and determine if it contains a person/model wearing clothing.

Respond with ONLY "YES" or "NO".

YES: If the image shows a person/model wearing garments
NO: If the image shows only garments/clothing without a person (flat lay, hanger, mannequin, etc.)`;

        const analyzeFn = httpsCallable(functions, 'analyzeGarment');

        const result = await analyzeFn({
            prompt,
            model: 'gemini-1.5-flash-latest', // Use fast model
            imageParts: [{
                inlineData: {
                    mimeType,
                    data: base64Data
                }
            }]
        });

        const responseData = result.data as any;
        const text = responseData.text?.trim().toUpperCase() || "NO";
        console.log('[detectModelInImage] Detection result:', text);

        return text === 'YES';
    } catch (error) {
        console.error('[detectModelInImage] Error:', error);
        return false; // Default to no model if detection fails
    }
}

/**
 * Extract garment from image using @imgly/background-removal for segmentation
 * and Gemini 2.5 Flash Image for metadata analysis.
 */
export async function extractGarmentFromImage(imageFile: File): Promise<GarmentExtractionResult> {
    try {
        console.log('[extractGarmentFromImage] Starting extraction for:', imageFile.name);

        // Run detection, analysis, and background removal in parallel
        const detectionPromise = detectModelInImage(imageFile);

        // Analyze the garment to determine type and confidence
        const analysisPrompt = `Analyze this garment image and provide:
1. Garment type (e.g., "Dress", "T-Shirt", "Jeans", "Jacket", "Blouse", "Skirt")
2. Confidence score (0-100) for extraction quality

Respond in JSON format:
{
  "garmentType": "type here",
  "confidence": 95
}`;

        const analyzeFn = httpsCallable(functions, 'analyzeGarment');
        const base64Data = await fileToBase64(imageFile);

        const analysisPromise = analyzeFn({
            prompt: analysisPrompt,
            model: 'gemini-1.5-flash-latest',
            imageParts: [{
                inlineData: {
                    mimeType: imageFile.type || "image/jpeg",
                    data: base64Data
                }
            }]
        });

        // Background removal
        console.log('[extractGarmentFromImage] Removing background...');
        const removalPromise = removeBackground(imageFile, {
            progress: (key, current, total) => {
                console.log(`[Background Removal] ${key}: ${current}/${total}`);
            }
        });

        // Wait for all promises
        const [hasModel, analysisResult, blob] = await Promise.all([
            detectionPromise,
            analysisPromise,
            removalPromise
        ]);

        console.log('[extractGarmentFromImage] Has model:', hasModel);

        // Process analysis result
        const responseData = analysisResult.data as any;
        const analysisText = responseData.text || "{}";
        let garmentType = 'Garment';
        let confidence = 90;

        try {
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                garmentType = parsed.garmentType || garmentType;
                confidence = parsed.confidence || confidence;
            }
        } catch (e) {
            console.warn('[extractGarmentFromImage] Failed to parse garment analysis:', e);
        }

        // Create URL for extracted image
        const extractedImageUrl = URL.createObjectURL(blob);

        console.log('[extractGarmentFromImage] Complete:', {
            garmentType,
            confidence,
            hasModel
        });

        return {
            extractedImageUrl,
            confidence,
            garmentType,
            hasModel
        };

    } catch (error) {
        console.error('[extractGarmentFromImage] Error:', error);
        throw new Error('Failed to extract garment from image. Please try again.');
    }
}

/**
 * Generate clean garment image on white background
 * This is a helper function that can be used independently
 */
export async function generateCleanGarmentImage(
    imageFile: File,
    garmentDescription?: string
): Promise<string> {
    try {
        const blob = await removeBackground(imageFile);
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('[generateCleanGarmentImage] Error:', error);
        throw new Error('Failed to generate clean garment image.');
    }
}
