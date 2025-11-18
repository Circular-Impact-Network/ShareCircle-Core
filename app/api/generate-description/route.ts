import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { itemTitle } = await request.json()

    if (!itemTitle) {
      return Response.json({ error: "Item title is required" }, { status: 400 })
    }

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Generate a compelling, brief product description (2-3 sentences) for a sharing/lending app for an item called "${itemTitle}". 
      Include practical information about the item that would help someone decide to borrow it. 
      Keep it concise and friendly. Do not include price information.`,
      temperature: 0.7,
    })

    return Response.json({ description: text })
  } catch (error) {
    console.error("Error generating description:", error)
    return Response.json({ error: "Failed to generate description" }, { status: 500 })
  }
}
