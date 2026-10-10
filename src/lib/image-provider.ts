import OpenAI from "openai";

export type InpaintRequest = {
  image: Buffer;
  mask: Buffer;
  prompt: string;
  mimeType: "image/png";
};

export interface ImageProvider {
  inpaint(input: InpaintRequest): Promise<Buffer>;
}

export class OpenAIImageProvider implements ImageProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async inpaint({ image, mask, prompt, mimeType }: InpaintRequest) {
    const response = await this.client.images.edit({
      model: process.env.IMAGE_MODEL || "gpt-image-1",
      image: new File([new Uint8Array(image)], "source.png", { type: mimeType }),
      mask: new File([new Uint8Array(mask)], "mask.png", { type: mimeType }),
      prompt,
      size: "auto",
      quality: "medium",
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("The image provider returned no edited image.");
    return Buffer.from(encoded, "base64");
  }
}

export function getImageProvider(): ImageProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Image editing is not configured. Add OPENAI_API_KEY to your server environment.");
  return new OpenAIImageProvider(apiKey);
}
