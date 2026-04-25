import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  agent: { type: String, required: true },
  role: { type: String },
  color: { type: String, required: true },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  code_snippet: { type: String },
  code_output: { type: String },
  round: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const verdictSchema = new mongoose.Schema({
  agreed_statement: { type: String, required: true },
  confirmed_by: [String],
  minority_note: { type: String }
}, { _id: false });

const reasoningTraceSchema = new mongoose.Schema({
  iteration: { type: Number, required: true },
  reasoning: { type: String, required: true },
  action: { type: String, enum: ['continue', 'tool_call', 'final_answer'], required: true },
  toolName: { type: String },
  toolResult: { type: String },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const debateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idea: { type: String, required: true },
  rounds: { type: Number, required: true },
  mode: { type: String, required: true },
  status: { type: String, enum: ['idle', 'running', 'done', 'error'], default: 'idle' },
  messages: [messageSchema],
  verdict: verdictSchema,
  reasoningTrace: [reasoningTraceSchema],
  createdAt: { type: Date, default: Date.now },
});

// For returning `id` instead of `_id` on the frontend
debateSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Debate = mongoose.model('Debate', debateSchema);
