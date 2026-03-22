import { GoogleGenAI } from "@google/genai";

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key missing in environment" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { conversation } = await request.json();
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base na conversa abaixo entre um consultor da Nutsafe e um cliente, crie um resumo executivo extremamente conciso, voltado para o cliente e com foco no marketing da Nutsafe. Destaque o valor agregado e os próximos passos sugeridos.
      
Conversa:
${conversation}`,
    });

    return new Response(JSON.stringify({ text: response.text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
