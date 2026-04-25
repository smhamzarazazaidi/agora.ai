import { Router } from 'express';
// Use dynamic require for bcrypt to avoid native module crashes on Vercel
let bcrypt: any;
try {
  bcrypt = require('bcrypt');
} catch {
  console.warn('bcrypt failed to load, falling back to mock');
  bcrypt = {
    genSalt: async () => 'salt',
    hash: async (p: string) => p,
    compare: async (p: string, h: string) => p === h
  };
}
import jwt from 'jsonwebtoken';
import { User } from '../config/mockDb';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'secret';

const generateToken = (userId: string) => {
  return jwt.sign({ userId }, SECRET, { expiresIn: '30d' });
};

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    res.status(201).json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      token: generateToken(user._id.toString()),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      token: generateToken(user._id.toString()),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
