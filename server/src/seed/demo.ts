import crypto from "crypto";
import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

import { hashPassword } from "../utils/password.js";

/*
|--------------------------------------------------------------------------
| Demo data
|--------------------------------------------------------------------------
|
| Creates a public demo account with a few direct
| chats and groups so visitors can try Tong without
| signing up. Runs once: if the demo account already
| exists nothing is changed. Set SEED_DEMO=false to
| disable.
*/

export const DEMO_EMAIL = "demo@tong.app";
export const DEMO_PASSWORD = "tongdemo123";

const people = {
  demo: {
    name: "Demo User",
    username: "demo",
    email: DEMO_EMAIL,
    bio: "Just looking around Tong 👋",
  },
  maya: {
    name: "Maya Chen",
    username: "maya",
    email: "maya@demo.tong.app",
    bio: "Product designer. Coffee first, pixels second.",
  },
  arif: {
    name: "Arif Hossain",
    username: "arif",
    email: "arif@demo.tong.app",
    bio: "Backend engineer · Dhaka",
  },
  sofia: {
    name: "Sofia Martins",
    username: "sofia",
    email: "sofia@demo.tong.app",
    bio: "Weekend hiker, weekday PM.",
  },
  leo: {
    name: "Leo Park",
    username: "leo",
    email: "leo@demo.tong.app",
    bio: "Frontend dev. Ask me about CSS grid.",
  },
  nadia: {
    name: "Nadia Rahman",
    username: "nadia",
    email: "nadia@demo.tong.app",
    bio: "Photographer 📷",
  },
} as const;

type Person = keyof typeof people;

interface SeedMessage {
  from: Person;
  text: string;
  /* Minutes before "now". */
  ago: number;
  react?: [Person, string][];
  replyTo?: number;
  edited?: boolean;
  /* Leave unread for the demo user. */
  unread?: boolean;
}

interface SeedConversation {
  type: "direct" | "group";
  name?: string;
  members: Person[];
  admins?: Person[];
  messages: SeedMessage[];
}

const DAY = 24 * 60;

const conversations: SeedConversation[] = [
  {
    type: "direct",
    members: ["demo", "maya"],
    messages: [
      { from: "maya", text: "Hey! Did you get a chance to look at the new onboarding screens?", ago: DAY + 95 },
      { from: "demo", text: "Yes! The welcome step feels much lighter now.", ago: DAY + 80 },
      { from: "maya", text: "Great. I'm still unsure about the illustration on step 2 though", ago: DAY + 78 },
      { from: "demo", text: "Maybe swap it for a short product clip?", ago: DAY + 60, react: [["maya", "🔥"]] },
      { from: "maya", text: "Ooh, I like that. I'll mock it up this afternoon", ago: 42, replyTo: 3 },
      { from: "maya", text: "Sent you a preview, let me know what you think 🙌", ago: 6, unread: true },
    ],
  },
  {
    type: "direct",
    members: ["demo", "arif"],
    messages: [
      { from: "arif", text: "Deploy went out, the API is about 30% faster on message history", ago: 3 * DAY },
      { from: "demo", text: "Nice work! Was it the new index?", ago: 3 * DAY - 10 },
      { from: "arif", text: "Yep, compound index on conversation + createdAt", ago: 3 * DAY - 12, react: [["demo", "👍"]] },
      { from: "demo", text: "Let's write that up for the team wiki", ago: 3 * DAY - 30 },
      { from: "arif", text: "On it. Also, lunch tomorrow?", ago: 3 * DAY - 31, edited: true },
      { from: "demo", text: "Sounds good, 1pm?", ago: 3 * DAY - 40, react: [["arif", "❤️"]] },
    ],
  },
  {
    type: "direct",
    members: ["demo", "sofia"],
    messages: [
      { from: "sofia", text: "Are we still on for the hike this Saturday?", ago: 8 * DAY },
      { from: "demo", text: "Definitely! Which trail?", ago: 8 * DAY - 20 },
      { from: "sofia", text: "Thinking the lakeside loop, about 12 km", ago: 8 * DAY - 22 },
      { from: "demo", text: "Perfect. I'll bring snacks 🍫", ago: 8 * DAY - 25, react: [["sofia", "😂"]] },
      { from: "sofia", text: "Meet at the parking lot at 8?", ago: 8 * DAY - 26 },
    ],
  },
  {
    type: "group",
    name: "Product Team",
    members: ["demo", "maya", "arif", "leo", "sofia"],
    admins: ["sofia", "demo"],
    messages: [
      { from: "sofia", text: "Morning all! Standup notes are in the doc ☀️", ago: 2 * DAY },
      { from: "leo", text: "Dark mode polish is merged 🎉", ago: 2 * DAY - 15, react: [["maya", "🔥"], ["arif", "🔥"], ["demo", "👍"]] },
      { from: "arif", text: "Read receipts are live in staging too", ago: 2 * DAY - 40 },
      { from: "maya", text: "Can we demo both on Friday?", ago: 2 * DAY - 45 },
      { from: "demo", text: "Yes, I'll put them on the agenda", ago: 2 * DAY - 50, replyTo: 3 },
      { from: "leo", text: "Quick reminder: retro is at 4pm today", ago: 25, unread: true },
    ],
  },
  {
    type: "group",
    name: "Weekend Hikers 🥾",
    members: ["demo", "sofia", "nadia", "leo"],
    admins: ["nadia"],
    messages: [
      { from: "nadia", text: "Photos from last weekend are up!", ago: 5 * DAY },
      { from: "sofia", text: "That sunrise shot is unreal 😮", ago: 5 * DAY - 5, react: [["nadia", "❤️"], ["demo", "😮"]] },
      { from: "leo", text: "Next trip: waterfall trail?", ago: 4 * DAY },
      { from: "demo", text: "I'm in!", ago: 4 * DAY - 3 },
      { from: "nadia", text: "Booking the cabin for the 21st then", ago: 90, unread: true },
      { from: "sofia", text: "Yay, can't wait!", ago: 80, unread: true },
    ],
  },
  {
    type: "group",
    name: "Book Club 📚",
    members: ["demo", "maya", "nadia"],
    admins: ["maya"],
    messages: [
      { from: "maya", text: "Next pick: Project Hail Mary?", ago: 12 * DAY },
      { from: "nadia", text: "Yes!! I've been meaning to read it", ago: 12 * DAY - 30 },
      { from: "demo", text: "Count me in. Two weeks enough?", ago: 12 * DAY - 45 },
      { from: "maya", text: "Two weeks it is 👍", ago: 12 * DAY - 50, react: [["demo", "👍"], ["nadia", "👍"]] },
      { from: "nadia", text: "No spoilers in here please 😂", ago: 11 * DAY },
    ],
  },
];

export async function seedDemoData() {
  if (process.env.SEED_DEMO === "false") {
    return;
  }

  const existing = await User.exists({ email: DEMO_EMAIL });

  if (existing) {
    return;
  }

  const usernames = Object.values(people).map((person) => person.username);
  const emails = Object.values(people).map((person) => person.email);

  const taken = await User.exists({
    $or: [{ username: { $in: usernames } }, { email: { $in: emails } }],
  });

  if (taken) {
    console.warn(
      "Demo seed skipped: a demo username or email is already registered.",
    );
    return;
  }

  console.log("Seeding demo data…");

  /*
   * Only the demo account has a known password;
   * the other demo people get random ones.
   */
  const ids = {} as Record<Person, mongoose.Types.ObjectId>;

  for (const [key, person] of Object.entries(people) as [Person, (typeof people)[Person]][]) {
    const password = await hashPassword(
      key === "demo" ? DEMO_PASSWORD : crypto.randomBytes(24).toString("hex"),
    );

    const user = await User.create({
      ...person,
      password,
      isVerified: key === "demo",
      lastSeen: new Date(Date.now() - (Object.keys(ids).length + 1) * 37 * 60_000),
    });

    ids[key] = user._id;
  }

  const now = Date.now();

  for (const seed of conversations) {
    const conversation = new Conversation({
      type: seed.type,
      name: seed.name,
      participants: seed.members.map((member) => ids[member]),
      admins: (seed.admins || []).map((member) => ids[member]),
    });

    await conversation.save();

    const saved: mongoose.Types.ObjectId[] = [];

    for (const item of seed.messages) {
      const createdAt = new Date(now - item.ago * 60_000);

      const readBy = item.unread
        ? [ids[item.from]]
        : seed.members.map((member) => ids[member]);

      const message = new Message({
        conversation: conversation._id,
        sender: ids[item.from],
        content: item.text,
        attachments: [],
        replyTo: item.replyTo !== undefined ? saved[item.replyTo] : undefined,
        reactions: (item.react || []).map(([person, emoji]) => ({
          user: ids[person],
          emoji,
        })),
        readBy,
        edited: Boolean(item.edited),
        deleted: false,
        createdAt,
        updatedAt: createdAt,
      });

      await message.save({ timestamps: false });

      saved.push(message._id);
    }

    const lastMessage = saved[saved.length - 1];
    const lastAt = new Date(now - seed.messages[seed.messages.length - 1].ago * 60_000);

    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { lastMessage, updatedAt: lastAt, createdAt: new Date(now - seed.messages[0].ago * 60_000) } },
      { timestamps: false },
    );
  }

  console.log(`Demo data ready. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}
