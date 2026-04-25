import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');

class MockDatabase {
  private debates: Map<string, any> = new Map();
  private users: Map<string, any> = new Map();
  private facts: Map<string, string[]> = new Map(); // userId -> facts[]
  private episodes: Map<string, any[]> = new Map(); // userId -> episodes[]

  constructor() {
    this.load();
  }

  private load() {
    if (process.env.VERCEL) return; // Skip FS on Vercel
    try {
      if (fs.existsSync(DB_PATH)) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        this.debates = new Map(Object.entries(data.debates || {}));
        this.users = new Map(Object.entries(data.users || {}));
        this.facts = new Map(Object.entries(data.facts || {}));
        this.episodes = new Map(Object.entries(data.episodes || {}));
      }
    } catch (err) {
      console.warn('⚠️ Failed to load db.json, starting fresh');
    }
  }

  private save() {
    if (process.env.VERCEL) return; // Skip FS on Vercel
    try {
      const data = {
        debates: Object.fromEntries(this.debates),
        users: Object.fromEntries(this.users),
        facts: Object.fromEntries(this.facts),
        episodes: Object.fromEntries(this.episodes)
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('❌ Failed to save db.json');
    }
  }

  // ─── Debates ───
  async findDebates(query: any = {}) {
    let list = Array.from(this.debates.values());
    if (query.userId) list = list.filter(d => d.userId === query.userId);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async findDebateById(id: string) {
    return this.debates.get(id);
  }

  async createDebate(data: any) {
    const id = uuidv4();
    const doc = { 
      _id: id, 
      ...data, 
      messages: data.messages || [],
      createdAt: new Date().toISOString() 
    };
    this.debates.set(id, doc);
    this.save();
    return doc;
  }

  async updateDebate(id: string, update: any) {
    const doc = this.debates.get(id);
    if (!doc) return null;
    
    if (update.$push && update.$push.messages) {
      doc.messages.push(update.$push.messages);
      delete update.$push;
    }
    
    const updated = { ...doc, ...update };
    this.debates.set(id, updated);
    this.save();
    return updated;
  }

  async deleteDebate(id: string) {
    const res = this.debates.delete(id);
    this.save();
    return res;
  }

  // ─── Users ───
  async findUserByEmail(email: string) {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(data: any) {
    const id = uuidv4();
    const doc = { _id: id, ...data, createdAt: new Date().toISOString() };
    this.users.set(id, doc);
    this.save();
    return doc;
  }

  async findUserById(id: string) {
    return this.users.get(id);
  }

  // ─── Memory ───
  async getFacts(userId: string) {
    return this.facts.get(userId) || [];
  }

  async addFact(userId: string, fact: string) {
    const list = this.facts.get(userId) || [];
    if (!list.includes(fact)) {
      list.push(fact);
      this.facts.set(userId, list);
      this.save();
    }
  }

  async getEpisodes(userId: string) {
    return this.episodes.get(userId) || [];
  }

  async addEpisode(userId: string, episode: any) {
    const list = this.episodes.get(userId) || [];
    list.push({ ...episode, timestamp: new Date().toISOString() });
    // Keep only last 20 episodes for performance
    const trimmed = list.slice(-20);
    this.episodes.set(userId, trimmed);
    this.save();
  }
}

export const db = new MockDatabase();

// Mimic Mongoose Model-like export for easier replacement
export const Debate = {
  find: (q: any = {}) => ({ 
    sort: (_s?: any) => db.findDebates(q) 
  }),
  findOne: (q: any) => db.findDebateById(q._id || q.id),
  findById: (id: string) => db.findDebateById(id),
  create: (data: any) => db.createDebate(data),
  findByIdAndUpdate: (id: string, update: any) => db.updateDebate(id, update),
  findOneAndUpdate: (q: any, update: any) => db.updateDebate(q._id || q.id, update),
  findOneAndDelete: (q: any) => db.deleteDebate(q._id || q.id),
};

export const User = {
  findOne: (q: any) => {
    if (q.email) return db.findUserByEmail(q.email);
    if (q._id) return db.findUserById(q._id);
    return null;
  },
  create: (data: any) => db.createUser(data),
  findById: (id: string | undefined) => id ? db.findUserById(id) : null,
};

export const Memory = {
  getFacts: (userId: string) => db.getFacts(userId),
  addFact: (userId: string, fact: string) => db.addFact(userId, fact),
  getEpisodes: (userId: string) => db.getEpisodes(userId),
  addEpisode: (userId: string, ep: any) => db.addEpisode(userId, ep),
};
