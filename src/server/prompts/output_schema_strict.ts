export const STRICT_OUTPUT_SCHEMA = `
<output_format>
  Your entire response MUST follow this exact structure with no deviations.
  Do NOT wrap your response in markdown code fences.
  Do NOT output anything before MODEL: or after the closing CODE block.
  CRITICAL: Do NOT include any placeholders, instructional text, or brackets like [ ] or < > in your final output.

  MODEL: (Write your model name exactly as defined in your identity prompt)

  SUMMARY:
  (Write exactly one to two sentences stating your core argument or rebuttal as a direct, declarative claim. Do not hedge.)

  DETAIL:
  (Write your full argument here in at least 3 substantive paragraphs. You MUST explicitly reference at least one other agent from the previous transcript and respond to their specific claims with an agreement, disagreement, or extension. Do not be generic.)

  CODE:
  (If including code, write valid, executable JavaScript only. Do NOT use markdown fences. If you have no code to contribute, write exactly the word NONE and nothing else. Do NOT add any conversational filler or thought processes after the code snippet. The word NONE or the code itself must be the absolute end of your response.)
</output_format>

<output_examples>
  <example name="valid_response">
MODEL: Gemini

SUMMARY:
The productivity gains attributed to remote work are real but fragile — they depend heavily on task type and erode significantly in roles requiring spontaneous collaboration.

DETAIL:
GPT correctly identifies the Stanford/Bloom (2015) study showing a 13% productivity increase among remote call center workers. However, this finding does not generalize beyond structured, measurable, solo-execution tasks. The same researchers found no equivalent gains in roles involving creative problem-solving or cross-functional coordination.

The distinction matters because modern knowledge work is increasingly collaborative. A 2023 Microsoft Work Trend Index analysis of 31,000 workers found that while individual output metrics held steady or improved remotely, cross-team innovation indicators — measured by patent filings, new product launches, and interdepartmental project completion rates — declined by 18-23% over a three-year period.

Claude's framing of this as a "hybrid model solves it" conclusion is premature. Hybrid arrangements introduce their own coordination costs: scheduling asymmetry, "presence penalty" bias in promotions, and the documented "two-tier" social dynamic between remote and in-office employees. The productivity question cannot be separated from these structural second-order effects.

CODE:
NONE
  </example>

  <example name="valid_with_code">
MODEL: GPT

SUMMARY:
The compounding effect of communication overhead in distributed teams follows a non-linear growth curve — a fact that makes simple headcount-based productivity comparisons systematically misleading.

DETAIL:
Gemini's citation of the 18-23% innovation decline is the strongest data point in this debate so far. But it raises a more fundamental issue: how we measure productivity in collaborative work is itself broken.

Traditional productivity metrics (output per hour, task completion rate) were designed for factory-floor workflows. Applied to knowledge work, they capture individual throughput while being blind to coordination costs. As team size grows, communication overhead grows at O(n²) — each new person adds n-1 new communication channels. Remote work amplifies this because asynchronous communication introduces latency into what would otherwise be instantaneous corridor interactions.

The implication is that remote teams are not simply "less productive" — they are operating under a fundamentally different cost structure. A team of 10 remote workers carries 45 communication channels; the same team in-office can compress many of those to ambient awareness. Measuring them on the same scale produces misleading comparisons.

CODE:
// Communication channel growth: O(n²)
function communicationChannels(teamSize) {
  return (teamSize * (teamSize - 1)) / 2;
}

const sizes = [5, 10, 20, 50];
sizes.forEach(n => {
  console.log(\`Team of \${n}: \${communicationChannels(n)} channels\`);
});
  </example>
</output_examples>
`;
