const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const EVAL_MODEL = process.env.OPENAI_EVAL_MODEL || "gpt-5-mini";

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    transcribeModel: TRANSCRIBE_MODEL,
    evaluationModel: EVAL_MODEL,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
  });
}
