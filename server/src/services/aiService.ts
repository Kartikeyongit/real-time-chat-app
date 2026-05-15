import { Message } from '../models/Message';
import { User } from '../models/User';

const ASSISTANT_EMAIL = process.env.AI_ASSISTANT_EMAIL || 'ai-assistant@local';
const ASSISTANT_USERNAME = process.env.AI_ASSISTANT_USERNAME || 'AI Assistant';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama2';

const getOllamaReply = async (messages: Array<{ role: string; content: string }>) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: messages.map(msg => ({
          role: msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })),
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 200,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content?.trim() || 'I\'m sorry, I could not generate a response right now.';
  } catch (error) {
    console.error('Ollama error:', error);
    throw error;
  }
};

export const getOrCreateAssistantUser = async () => {
  let botUser = await User.findOne({ email: ASSISTANT_EMAIL });
  if (!botUser) {
    botUser = new User({
      username: ASSISTANT_USERNAME,
      email: ASSISTANT_EMAIL,
      password: Math.random().toString(36).slice(2) + Date.now().toString(),
      avatar: '',
      online: false,
      lastSeen: new Date(),
      publicKey: '',
      encryptedPrivateKey: '',
      keySalt: '',
      twoFactorEnabled: false,
      encryptionEnabled: false,
    });
    await botUser.save();
  }
  return botUser;
};

export const getAssistantReply = async (roomId: string, userMessage: string) => {
  try {
    const previousMessages = await Message.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('sender', 'username');

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: 'You are a friendly AI assistant operating inside a chat application. Keep answers helpful and concise.',
      },
    ];

    previousMessages.reverse().forEach((message) => {
      const senderName = (message.sender as any)?.username || 'User';
      const content = message.content || '';
      if (senderName === ASSISTANT_USERNAME) {
        messages.push({ role: 'assistant', content });
      } else {
        messages.push({ role: 'user', content });
      }
    });

    messages.push({ role: 'user', content: userMessage });

    return await getOllamaReply(messages);

  } catch (error) {
    console.error('AI assistant error:', error);
    console.error('Error details:', {
      message: (error as any)?.message,
      status: (error as any)?.status,
      code: (error as any)?.code,
      type: (error as any)?.type,
    });
    return 'I\'m sorry, I\'m having trouble answering right now.';
  }
};