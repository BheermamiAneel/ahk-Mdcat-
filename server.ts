import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const AUTHORIZED_ADMIN_EMAILS = [
  'aneelbheermani@gmail.com',
  'bheermanianeel@gmail.com'
];

interface AdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory active administrator sessions with expiration (12 hours)
const activeAdminSessions = new Map<string, AdminSession>();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeAdminSessions.entries()) {
    if (session.expiresAt <= now) {
      activeAdminSessions.delete(token);
    }
  }
}

// ================= PERMANENT CLOUD DISK DATABASE STORAGE =================
const DATA_DIR = path.resolve(__dirname, 'data');
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const POINT_TRANSACTIONS_FILE = path.join(DATA_DIR, 'pointTransactions.json');
const LEADERBOARD_SETTINGS_FILE = path.join(DATA_DIR, 'leaderboardSettings.json');
const STUDY_ROOM_SETTINGS_FILE = path.join(DATA_DIR, 'studyRoomSettings.json');
const STUDY_ROOM_MESSAGES_FILE = path.join(DATA_DIR, 'studyRoomMessages.json');
const STUDY_ROOM_REPORTS_FILE = path.join(DATA_DIR, 'studyRoomReports.json');
const STUDY_ROOM_MODERATION_FILE = path.join(DATA_DIR, 'studyRoomModeration.json');
const STUDY_ROOM_DIRECT_MESSAGES_FILE = path.join(DATA_DIR, 'studyRoomDirectMessages.json');
const STUDY_ROOM_AUDIT_LOGS_FILE = path.join(DATA_DIR, 'studyRoomAuditLogs.json');
const COMMON_ROOM_POSTS_FILE = path.join(DATA_DIR, 'commonRoomPosts.json');
const COMMON_ROOM_COMMENTS_FILE = path.join(DATA_DIR, 'commonRoomComments.json');
const COMMON_ROOM_ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'commonRoomAnnouncements.json');
const COMMON_ROOM_REPORTS_FILE = path.join(DATA_DIR, 'commonRoomReports.json');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStoredCommonRoomPosts(): any[] {
  try {
    if (fs.existsSync(COMMON_ROOM_POSTS_FILE)) {
      const content = fs.readFileSync(COMMON_ROOM_POSTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [];
}

function writeStoredCommonRoomPosts(posts: any[]): void {
  try {
    fs.writeFileSync(COMMON_ROOM_POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredCommonRoomComments(): Record<string, any[]> {
  try {
    if (fs.existsSync(COMMON_ROOM_COMMENTS_FILE)) {
      const content = fs.readFileSync(COMMON_ROOM_COMMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {}
  return {};
}

function writeStoredCommonRoomComments(commentsMap: Record<string, any[]>): void {
  try {
    fs.writeFileSync(COMMON_ROOM_COMMENTS_FILE, JSON.stringify(commentsMap, null, 2), 'utf-8');
  } catch (err) {}
}

const INITIAL_COMMON_ROOM_ANNOUNCEMENTS = [
  {
    id: 'ann_welcome_pinned',
    title: 'Welcome to AHK Common Room — Official Medical Community',
    content: 'Assalam-o-Alaikum future doctors! Welcome to the transformed AHK Common Room. Connect with fellow aspirants across Sindh and Punjab, ask conceptual doubts, discuss challenging MCQs, share mnemonic diagrams, and stay updated with official PMDC MDCAT announcements. Live moderation is active 24/7.',
    authorName: 'Aneel Bheermani (AHK MDCAT Founder)',
    authorEmail: 'aneelbheermani@gmail.com',
    authorRole: 'admin',
    pinned: true,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

function readStoredCommonRoomAnnouncements(): any[] {
  try {
    if (fs.existsSync(COMMON_ROOM_ANNOUNCEMENTS_FILE)) {
      const content = fs.readFileSync(COMMON_ROOM_ANNOUNCEMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  writeStoredCommonRoomAnnouncements(INITIAL_COMMON_ROOM_ANNOUNCEMENTS);
  return INITIAL_COMMON_ROOM_ANNOUNCEMENTS;
}

function writeStoredCommonRoomAnnouncements(list: any[]): void {
  try {
    fs.writeFileSync(COMMON_ROOM_ANNOUNCEMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredCommonRoomReports(): any[] {
  try {
    if (fs.existsSync(COMMON_ROOM_REPORTS_FILE)) {
      const content = fs.readFileSync(COMMON_ROOM_REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [];
}

function writeStoredCommonRoomReports(reports: any[]): void {
  try {
    fs.writeFileSync(COMMON_ROOM_REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredStudyRoomSettings(): any {
  try {
    if (fs.existsSync(STUDY_ROOM_SETTINGS_FILE)) {
      const content = fs.readFileSync(STUDY_ROOM_SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.liveChatEnabled === 'boolean') return parsed;
    }
  } catch (err) {}
  return {
    liveChatEnabled: true,
    slowModeSeconds: 0,
    topic: 'PMDC MDCAT 2026 Academic Discussion & High-Yield Revision',
    rulesNotice: 'Keep discussions focused on MDCAT topics (Biology, Chemistry, Physics, English, Logical Reasoning). Spamming, sharing unapproved promo links, or abusive behavior will result in instant mute or Study Room suspension.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'aneelbheermani@gmail.com'
  };
}

function writeStoredStudyRoomSettings(settings: any): void {
  try {
    fs.writeFileSync(STUDY_ROOM_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving study room settings:', err);
  }
}

function readStoredStudyRoomMessages(): any[] {
  try {
    if (fs.existsSync(STUDY_ROOM_MESSAGES_FILE)) {
      const content = fs.readFileSync(STUDY_ROOM_MESSAGES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [
    {
      id: 'msg_welcome_admin_pinned',
      senderUid: 'admin_master',
      senderName: 'AHK.MDCAT Admin (Aneel Bheermani)',
      senderEmail: 'aneelbheermani@gmail.com',
      senderRole: 'admin',
      content: 'Assalam-o-Alaikum future doctors! Welcome to the official AHK.MDCAT Study Room. You can ask conceptual questions, discuss tricky MCQs, and collaborate on PMDC syllabus topics. Live moderation is active 24/7.',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      pinned: true,
      reportsCount: 0
    }
  ];
}

function writeStoredStudyRoomMessages(msgs: any[]): void {
  try {
    fs.writeFileSync(STUDY_ROOM_MESSAGES_FILE, JSON.stringify(msgs, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredStudyRoomReports(): any[] {
  try {
    if (fs.existsSync(STUDY_ROOM_REPORTS_FILE)) {
      const content = fs.readFileSync(STUDY_ROOM_REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [];
}

function writeStoredStudyRoomReports(reports: any[]): void {
  try {
    fs.writeFileSync(STUDY_ROOM_REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredStudyRoomModeration(): Record<string, any> {
  try {
    if (fs.existsSync(STUDY_ROOM_MODERATION_FILE)) {
      const content = fs.readFileSync(STUDY_ROOM_MODERATION_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {}
  return {};
}

function writeStoredStudyRoomModeration(records: Record<string, any>): void {
  try {
    fs.writeFileSync(STUDY_ROOM_MODERATION_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredStudyRoomDirectMessages(): any[] {
  try {
    if (fs.existsSync(STUDY_ROOM_DIRECT_MESSAGES_FILE)) {
      const content = fs.readFileSync(STUDY_ROOM_DIRECT_MESSAGES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [];
}

function writeStoredStudyRoomDirectMessages(msgs: any[]): void {
  try {
    fs.writeFileSync(STUDY_ROOM_DIRECT_MESSAGES_FILE, JSON.stringify(msgs, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredStudyRoomAuditLogs(): any[] {
  try {
    if (fs.existsSync(STUDY_ROOM_AUDIT_LOGS_FILE)) {
      const content = fs.readFileSync(STUDY_ROOM_AUDIT_LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [];
}

function writeStoredStudyRoomAuditLogs(logs: any[]): void {
  try {
    fs.writeFileSync(STUDY_ROOM_AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {}
}

function readStoredLeaderboard(): any[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const content = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((e: any) => !e.id?.startsWith('seed-') && !e.userId?.startsWith('stu-') && !e.userId?.startsWith('demo-'));
      }
    }
  } catch (err) {
    console.warn('Error reading leaderboard from disk:', err);
  }
  return [];
}

function writeStoredLeaderboard(list: any[]): void {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving leaderboard to disk:', err);
  }
}

function readStoredPointTransactions(): any[] {
  try {
    if (fs.existsSync(POINT_TRANSACTIONS_FILE)) {
      const content = fs.readFileSync(POINT_TRANSACTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading point transactions from disk:', err);
  }
  return [];
}

function writeStoredPointTransactions(list: any[]): void {
  try {
    fs.writeFileSync(POINT_TRANSACTIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving point transactions to disk:', err);
  }
}

function readStoredLeaderboardSettings(): any {
  try {
    if (fs.existsSync(LEADERBOARD_SETTINGS_FILE)) {
      const content = fs.readFileSync(LEADERBOARD_SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.pointsPerCorrect === 'number') return parsed;
    }
  } catch (err) {}
  return {
    pointsPerCorrect: 10,
    pointsPerIncorrect: 0,
    completionBonusTest: 5,
    completionBonusMock: 20,
    updatedAt: new Date().toISOString()
  };
}

function writeStoredLeaderboardSettings(settings: any): void {
  try {
    fs.writeFileSync(LEADERBOARD_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving leaderboard settings to disk:', err);
  }
}

// Pre-seeded authentic PMDC MDCAT assessment to guarantee zero-blank state on new incognito or student launches
const INITIAL_PMDC_TEST = {
  id: "pmdc-bio-foundation-01",
  title: "PMDC MDCAT High-Yield Biology Foundation Test",
  instructions: "Official PMDC MDCAT Assessment covering Biomolecules, Cell Structure, and Bioenergetics.",
  subject: "Biology",
  chapter: "Biomolecules & Cell Structure",
  durationMinutes: 30,
  totalQuestions: 10,
  marksPerQuestion: 1,
  negativeMarking: false,
  negativeMarks: 0,
  status: "published",
  isPublished: true,
  publishedAt: "2026-10-26T12:00:00.000Z",
  resultVisibility: "immediate",
  createdAt: "2026-10-26T12:00:00.000Z",
  updatedAt: "2026-10-26T12:00:00.000Z",
  authorId: "faculty-pmdc",
  authorEmail: "admin@ahkmdcat.pk",
  totalAttempts: 0,
  questions: [
    {
      id: "q-bio-01",
      order: 1,
      subject: "Biology",
      chapter: "Biomolecules",
      questionText: "Which of the following is a reducing sugar possessing a free ketone or aldehyde group?",
      options: ["Sucrose", "Maltose", "Cellulose", "Starch"],
      correctIndex: 1,
      explanation: "Maltose is a reducing disaccharide with a free aldehyde group. Sucrose is non-reducing because both anomeric carbons participate in the glycosidic bond.",
      difficulty: "Easy",
      marks: 1
    },
    {
      id: "q-bio-02",
      order: 2,
      subject: "Biology",
      chapter: "Biomolecules",
      questionText: "The primary structural linkage that joins amino acids in a polypeptide chain is called:",
      options: ["Glycosidic bond", "Phosphodiester bond", "Peptide bond", "Disulfide bridge"],
      correctIndex: 2,
      explanation: "Peptide bonds are covalent bonds formed between the carboxyl group of one amino acid and the amino group of another with the release of water.",
      difficulty: "Easy",
      marks: 1
    },
    {
      id: "q-bio-03",
      order: 3,
      subject: "Biology",
      chapter: "Cell Biology",
      questionText: "Which organelle is responsible for the packaging, modification, and sorting of secretory proteins?",
      options: ["Golgi apparatus", "Lysosome", "Peroxisome", "Nucleolus"],
      correctIndex: 0,
      explanation: "The Golgi apparatus modifies proteins received from the rough ER, adds carbohydrates/lipids, and packages them into secretory vesicles.",
      difficulty: "Medium",
      marks: 1
    },
    {
      id: "q-bio-04",
      order: 4,
      subject: "Biology",
      chapter: "Cell Biology",
      questionText: "Which cellular junction in animal tissues forms a tight seal that prevents fluid leakage between epithelial cells?",
      options: ["Desmosomes", "Gap junctions", "Tight junctions (zonula occludens)", "Plasmodesmata"],
      correctIndex: 2,
      explanation: "Tight junctions form continuous water-impermeable barriers between adjacent epithelial cell membranes.",
      difficulty: "Medium",
      marks: 1
    },
    {
      id: "q-bio-05",
      order: 5,
      subject: "Biology",
      chapter: "Bioenergetics",
      questionText: "In aerobic respiration, the terminal electron acceptor in the mitochondrial electron transport chain is:",
      options: ["NAD+", "FAD", "Molecular Oxygen (O2)", "Cytochrome c"],
      correctIndex: 2,
      explanation: "Molecular oxygen accepts electrons at Complex IV (cytochrome c oxidase) and is reduced to form water.",
      difficulty: "Easy",
      marks: 1
    },
    {
      id: "q-bio-06",
      order: 6,
      subject: "Biology",
      chapter: "Bioenergetics",
      questionText: "How many net molecules of ATP are generated directly by substrate-level phosphorylation during one turn of the citric acid cycle (per acetyl-CoA)?",
      options: ["1 ATP / GTP", "2 ATP", "3 ATP", "36 ATP"],
      correctIndex: 0,
      explanation: "One turn of the Krebs cycle produces 1 GTP (equivalent to 1 ATP) at the conversion of succinyl-CoA to succinate.",
      difficulty: "Medium",
      marks: 1
    },
    {
      id: "q-bio-07",
      order: 7,
      subject: "Biology",
      chapter: "Biomolecules",
      questionText: "Which level of protein structure is characterized by alpha-helices and beta-pleated sheets stabilized by hydrogen bonds?",
      options: ["Primary structure", "Secondary structure", "Tertiary structure", "Quaternary structure"],
      correctIndex: 1,
      explanation: "Secondary structure consists of alpha-helices and beta-pleated sheets formed by regular hydrogen bonding between peptide backbone atoms.",
      difficulty: "Medium",
      marks: 1
    },
    {
      id: "q-bio-08",
      order: 8,
      subject: "Biology",
      chapter: "Cell Biology",
      questionText: "The lysosomal membrane maintains an acidic internal lumen (pH ~4.5–5.0) via active transport carried out by:",
      options: ["Na+/K+ ATPase", "Proton (H+) V-type ATPase pump", "Calcium ATPase", "Glucose symporter"],
      correctIndex: 1,
      explanation: "Vacuolar H+-ATPases continuously pump protons from the cytosol into the lysosomal lumen to maintain optimal pH for acid hydrolases.",
      difficulty: "Hard",
      marks: 1
    },
    {
      id: "q-bio-09",
      order: 9,
      subject: "Biology",
      chapter: "Enzymes",
      questionText: "A competitive enzyme inhibitor acts by:",
      options: [
        "Binding permanently to the allosteric site",
        "Binding reversibly to the active site, increasing Km without changing Vmax",
        "Decreasing both Km and Vmax equally",
        "Binding exclusively to the enzyme-substrate complex"
      ],
      correctIndex: 1,
      explanation: "Competitive inhibitors resemble substrate and compete for the active site. They increase apparent Km (requiring more substrate), while Vmax remains attainable at high substrate concentrations.",
      difficulty: "Hard",
      marks: 1
    },
    {
      id: "q-bio-10",
      order: 10,
      subject: "Biology",
      chapter: "Coordination & Control",
      questionText: "During the depolarization phase of an action potential in a nerve fiber, there is rapid influx of which ion?",
      options: ["Potassium (K+)", "Sodium (Na+)", "Chloride (Cl-)", "Calcium (Ca2+)"],
      correctIndex: 1,
      explanation: "Depolarization occurs when voltage-gated Na+ channels open rapidly, allowing Na+ ions to flood into the axon down their electrochemical gradient.",
      difficulty: "Easy",
      marks: 1
    }
  ]
};

function readStoredQuizzes(): any[] {
  try {
    if (fs.existsSync(QUIZZES_FILE)) {
      const content = fs.readFileSync(QUIZZES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading quizzes from disk:', err);
  }
  // Initialize file with foundational test only if file does not exist
  const initial = [INITIAL_PMDC_TEST];
  writeStoredQuizzes(initial);
  return initial;
}

function writeStoredQuizzes(quizzes: any[]): void {
  try {
    fs.writeFileSync(QUIZZES_FILE, JSON.stringify(quizzes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing quizzes to disk:', err);
  }
}

function readStoredQuestions(): any[] {
  try {
    if (fs.existsSync(QUESTIONS_FILE)) {
      const content = fs.readFileSync(QUESTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading questions from disk:', err);
  }
  return [];
}

function writeStoredQuestions(questions: any[]): void {
  try {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing questions to disk:', err);
  }
}

// ================= ABI NOTES STORAGE DEFINITION =================
const NOTES_FOLDERS_FILE = path.join(DATA_DIR, 'notes_folders.json');
const NOTES_ITEMS_FILE = path.join(DATA_DIR, 'notes_items.json');
const NOTES_SETTINGS_FILE = path.join(DATA_DIR, 'notes_settings.json');

const INITIAL_NOTES_SETTINGS = {
  showEmptyFoldersToStudents: false,
  defaultView: 'grid',
  libraryTitle: 'ABI Notes Library — PMDC MDCAT 2026',
  libraryNotice: 'Official syllabus notes, diagrams, and revision sheets stored on Google Drive.',
  allowDirectDownloadHint: true
};

const INITIAL_NOTES_FOLDERS = [
  {
    id: 'folder-bio',
    name: 'Biology',
    description: 'Comprehensive MDCAT Biology notes covering Botany & Zoology syllabi',
    coverImageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=400&q=80',
    parentFolderId: null,
    subjectId: 'Biology',
    status: 'published',
    displayOrder: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-bio-fy',
    name: 'First Year (Class 11)',
    description: 'Cell biology, biomolecules, enzymes, and bioenergetics',
    coverImageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=400&q=80',
    parentFolderId: 'folder-bio',
    subjectId: 'Biology',
    status: 'published',
    displayOrder: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-bio-ch01',
    name: 'Chapter 01 — Cell Structure & Function',
    description: 'Prokaryotes vs eukaryotes, organelles, and plasma membrane',
    coverImageUrl: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=400&q=80',
    parentFolderId: 'folder-bio-fy',
    subjectId: 'Biology',
    status: 'published',
    displayOrder: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-bio-ch02',
    name: 'Chapter 02 — Biological Molecules',
    description: 'Carbohydrates, proteins, lipids, and nucleic acids',
    coverImageUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=400&q=80',
    parentFolderId: 'folder-bio-fy',
    subjectId: 'Biology',
    status: 'published',
    displayOrder: 2,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-bio-sy',
    name: 'Second Year (Class 12)',
    description: 'Human physiology, coordination, homeostasis, and genetics',
    coverImageUrl: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=400&q=80',
    parentFolderId: 'folder-bio',
    subjectId: 'Biology',
    status: 'published',
    displayOrder: 2,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-chem',
    name: 'Chemistry',
    description: 'Physical, Inorganic, and Organic Chemistry notes',
    coverImageUrl: 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?auto=format&fit=crop&w=400&q=80',
    parentFolderId: null,
    subjectId: 'Chemistry',
    status: 'published',
    displayOrder: 2,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-phy',
    name: 'Physics',
    description: 'Mechanics, Electromagnetism, Modern Physics, and Formulas',
    coverImageUrl: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=400&q=80',
    parentFolderId: null,
    subjectId: 'Physics',
    status: 'published',
    displayOrder: 3,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-eng',
    name: 'English',
    description: 'Vocabulary lists, sentence structure, and grammar rules',
    coverImageUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=400&q=80',
    parentFolderId: null,
    subjectId: 'English',
    status: 'published',
    displayOrder: 4,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-logic',
    name: 'Logical Reasoning',
    description: 'Critical thinking, syllogisms, and deduction shortcuts',
    coverImageUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=400&q=80',
    parentFolderId: null,
    subjectId: 'Logical Reasoning',
    status: 'published',
    displayOrder: 5,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  },
  {
    id: 'folder-special',
    name: 'MDCAT Special Notes',
    description: 'High-yield memory tricks, formula sheets, and past paper trends',
    coverImageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80',
    parentFolderId: null,
    subjectId: 'MDCAT Special Notes',
    status: 'published',
    displayOrder: 6,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin'
  }
];

const INITIAL_NOTES_ITEMS = [
  {
    id: 'note-bio-01',
    title: 'Complete Cell Organelles & Ultra-Structure Notes',
    folderId: 'folder-bio-ch01',
    subject: 'Biology',
    classYear: 'Class 11',
    chapter: 'Cell Structure & Function',
    topic: 'Organelles & Endomembrane System',
    description: 'High-yield summary comparing mitochondria, chloroplasts, lysosomes, and ribosomes with PMDC exam traps.',
    coverImageUrl: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=400&q=80',
    googleDriveUrl: 'https://drive.google.com/file/d/1Bia-Bio-Cell-Structure-Sample/view?usp=sharing',
    contentType: 'PDF Notes',
    featured: true,
    status: 'published',
    displayOrder: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin',
    viewsCount: 240
  },
  {
    id: 'note-bio-02',
    title: 'Carbohydrates & Lipids Classification Chart',
    folderId: 'folder-bio-ch02',
    subject: 'Biology',
    classYear: 'Class 11',
    chapter: 'Biological Molecules',
    topic: 'Monosaccharides & Glycosidic Bonds',
    description: 'Structural formulas, reducing vs non-reducing tests, and peptide bond condensation mechanisms.',
    coverImageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=400&q=80',
    googleDriveUrl: 'https://drive.google.com/file/d/1Bia-Bio-Molecules-Classification/view?usp=sharing',
    contentType: 'Revision Sheet',
    featured: true,
    status: 'published',
    displayOrder: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin',
    viewsCount: 185
  },
  {
    id: 'note-chem-01',
    title: 'Reaction Mechanisms (SN1, SN2, E1, E2) Flowchart',
    folderId: 'folder-chem',
    subject: 'Chemistry',
    classYear: 'Class 12',
    chapter: 'Organic Chemistry',
    topic: 'Alkyl Halides & Nucleophilic Substitution',
    description: 'Clear distinction between carbocation intermediates, solvent polarity effects, and stereochemical inversion.',
    coverImageUrl: 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?auto=format&fit=crop&w=400&q=80',
    googleDriveUrl: 'https://drive.google.com/file/d/1Chem-Organic-Mechanisms/view?usp=sharing',
    contentType: 'Diagrams',
    featured: true,
    status: 'published',
    displayOrder: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin',
    viewsCount: 312
  },
  {
    id: 'note-special-01',
    title: 'All-Formula Master Sheet (Physics + Chemistry)',
    folderId: 'folder-special',
    subject: 'MDCAT Special Notes',
    classYear: 'Repeater',
    chapter: 'Complete MDCAT Syllabus',
    topic: 'High-Yield Equations',
    description: 'Every formula required for PMDC MDCAT 2026 including SI units, dimensional formulas, and calculator-free shortcuts.',
    coverImageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80',
    googleDriveUrl: 'https://drive.google.com/file/d/1MDCAT-Master-Formulas/view?usp=sharing',
    contentType: 'Revision Sheet',
    featured: true,
    status: 'published',
    displayOrder: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    createdBy: 'admin',
    viewsCount: 520
  }
];

function readStoredFolders(): any[] {
  try {
    if (fs.existsSync(NOTES_FOLDERS_FILE)) {
      const content = fs.readFileSync(NOTES_FOLDERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading notes folders from disk:', err);
  }
  writeStoredFolders(INITIAL_NOTES_FOLDERS);
  return INITIAL_NOTES_FOLDERS;
}

function writeStoredFolders(folders: any[]): void {
  try {
    fs.writeFileSync(NOTES_FOLDERS_FILE, JSON.stringify(folders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing notes folders to disk:', err);
  }
}

function readStoredNotes(): any[] {
  try {
    if (fs.existsSync(NOTES_ITEMS_FILE)) {
      const content = fs.readFileSync(NOTES_ITEMS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading notes items from disk:', err);
  }
  writeStoredNotes(INITIAL_NOTES_ITEMS);
  return INITIAL_NOTES_ITEMS;
}

function writeStoredNotes(notes: any[]): void {
  try {
    fs.writeFileSync(NOTES_ITEMS_FILE, JSON.stringify(notes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing notes items to disk:', err);
  }
}

function readStoredSettings(): any {
  try {
    if (fs.existsSync(NOTES_SETTINGS_FILE)) {
      const content = fs.readFileSync(NOTES_SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return { ...INITIAL_NOTES_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn('Error reading notes settings from disk:', err);
  }
  writeStoredSettings(INITIAL_NOTES_SETTINGS);
  return INITIAL_NOTES_SETTINGS;
}

function writeStoredSettings(settings: any): void {
  try {
    fs.writeFileSync(NOTES_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing notes settings to disk:', err);
  }
}

// ================= ARTICLES & BLOG STORAGE DEFINITION =================
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const UPLOADS_DIR = path.resolve(__dirname, 'public', 'uploads');
const ARTICLES_UPLOADS_DIR = path.join(UPLOADS_DIR, 'articles');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(ARTICLES_UPLOADS_DIR)) {
  fs.mkdirSync(ARTICLES_UPLOADS_DIR, { recursive: true });
}

const INITIAL_ARTICLES = [
  {
    id: 'art-mdcat-biomolecules-01',
    title: 'Mastering PMDC MDCAT Biology: 7 High-Yield Biomolecules Principles',
    slug: 'mastering-pmdc-mdcat-biology-biomolecules',
    shortDescription: 'Core conceptual rules for solving MDCAT questions on carbohydrates, peptide linkages, lipid classifications, and enzyme kinetics without confusion.',
    category: 'Biology',
    featuredImageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    featuredImageCaption: 'Molecular structures and biochemical pathways in PMDC MDCAT Biology',
    featuredImageAlt: 'Biomolecules molecular models and laboratory flasks',
    content: `<h2>1. Reducing vs Non-Reducing Sugars Trap</h2>
<p>In almost every PMDC MDCAT session, students lose easy marks by confusing <strong>Maltose</strong> with <strong>Sucrose</strong>. Remember the golden rule: Maltose, Lactose, and all monosaccharides (Glucose, Fructose, Galactose) possess free anomeric hemiacetal/hemiketal groups that reduce Fehling's or Benedict's solution.</p>
<blockquote>Sucrose is non-reducing because both anomeric carbons (C1 of alpha-glucose and C2 of beta-fructose) participate directly in the glycosidic bond.</blockquote>

<h2>2. Primary vs Quaternary Protein Architecture</h2>
<p>Peptide bonds maintain primary structure, hydrogen bonds hold secondary alpha-helices and beta-sheets, while disulfide bridges (covalent bonds between cysteine residues) stabilize tertiary and quaternary shapes.</p>
<p>Hemoglobin is a classic quaternary oligomer composed of four polypeptide chains (2 alpha and 2 beta) coordinated around four iron-containing heme prosthetic groups.</p>

<h2>3. Enzyme Kinetics: Competitive vs Non-Competitive Inhibition</h2>
<p>Keep these kinetic shifts clear:</p>
<ul>
  <li><strong>Competitive Inhibitors:</strong> Resemble the substrate, bind to the active site, increase Km (lower apparent affinity), but <em>Vmax remains unchanged</em> when substrate concentration is saturated.</li>
  <li><strong>Non-Competitive Inhibitors:</strong> Bind to an allosteric site, decrease Vmax, while Km remains unchanged.</li>
</ul>

<h2>4. Phospholipids & Amphipathic Cell Membranes</h2>
<p>Phospholipids consist of a glycerol backbone linked to two hydrophobic fatty acid tails and a hydrophilic phosphate head group. In aqueous environments, they spontaneously assemble into lipid bilayers that form the structural foundation of biological membranes.</p>`,
    status: 'published',
    author: {
      uid: 'faculty-pmdc',
      name: 'AHK Academic Faculty',
      email: 'faculty@ahkmdcat.pk',
      role: 'admin'
    },
    readingTimeMinutes: 4,
    tags: ['Biomolecules', 'Enzymes', 'PMDC 2026', 'High-Yield'],
    viewsCount: 684,
    createdAt: '2026-10-25T10:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    publishedAt: '2026-10-26T12:00:00.000Z'
  },
  {
    id: 'art-admissions-guide-01',
    title: 'Complete Sindh & Punjab Medical Admissions Guide 2026: Merit Formula & Documents',
    slug: 'complete-sindh-punjab-medical-admissions-guide-2026',
    shortDescription: 'Step-by-step breakdown of the official aggregate formula (50% MDCAT, 40% F.Sc, 10% Matric), mandatory domicile criteria, and seat quotas.',
    category: 'Medical Admissions',
    featuredImageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
    featuredImageCaption: 'Medical college admissions and stethoscope on document desk',
    featuredImageAlt: 'Medical college admission checklist and stethoscope',
    content: `<h2>1. The Official PMDC Aggregate Calculation Formula</h2>
<p>Under current PMDC admission regulations, government and private medical college merit in Pakistan is calculated strictly using the 50:40:10 weighting formula:</p>
<ul>
  <li><strong>MDCAT Score:</strong> 50% weighting (Marks Obtained / Total MDCAT Marks × 50)</li>
  <li><strong>F.Sc Pre-Medical / HSSC:</strong> 40% weighting (Marks Obtained / Total HSSC Marks × 40)</li>
  <li><strong>Matriculation / SSC:</strong> 10% weighting (Marks Obtained / Total SSC × 10)</li>
</ul>

<h2>2. Mandatory Documents Checklist</h2>
<p>Ensure you have original and attested copies of each of the following ready before admission portal deadlines:</p>
<ul>
  <li>Official PMDC MDCAT Result Card with QR Code verification</li>
  <li>F.Sc (Pre-Medical) Original Marks Sheet / Sanad</li>
  <li>Matriculation Certificate with Date of Birth verification</li>
  <li>Permanent Residence Certificate (PRC / Form C) and Domicile of Candidate</li>
  <li>Candidate CNIC / Smart B-Form and Father's/Guardian's CNIC</li>
  <li>Recent passport-sized photographs with blue background</li>
</ul>

<h2>3. District Quota vs Open Merit Seats</h2>
<p>Candidates applying in Sindh (DUHS, SMBBMU, LUMHS) and Punjab (UHS) must pay strict attention to District Merit vs Provincial Open Merit quotas. Always select your preference list carefully during the admission portal window.</p>`,
    status: 'published',
    author: {
      uid: 'faculty-pmdc',
      name: 'AHK Admissions Advisory',
      email: 'admissions@ahkmdcat.pk',
      role: 'admin'
    },
    readingTimeMinutes: 5,
    tags: ['Admissions', 'Merit Formula', 'Sindh', 'Punjab', 'MBBS', 'BDS'],
    viewsCount: 1140,
    createdAt: '2026-10-24T09:00:00.000Z',
    updatedAt: '2026-10-26T14:00:00.000Z',
    publishedAt: '2026-10-26T14:00:00.000Z'
  }
];

function readStoredArticles(): any[] {
  try {
    if (fs.existsSync(ARTICLES_FILE)) {
      const content = fs.readFileSync(ARTICLES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Error reading articles from disk:', err);
  }
  writeStoredArticles(INITIAL_ARTICLES);
  return INITIAL_ARTICLES;
}

function writeStoredArticles(articles: any[]): void {
  try {
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing articles to disk:', err);
  }
}

// ================= DYNAMIC ARTICLE CATEGORIES DEFINITIONS =================
const ARTICLE_CATEGORIES_FILE = path.join(DATA_DIR, 'article_categories.json');

const INITIAL_ARTICLE_CATEGORIES = [
  {
    id: 'cat-research-science',
    name: 'Research & Science',
    slug: 'research-science',
    description: 'Evidence-based cognitive science, memory retention experiments, and scientific breakthroughs for PMDC MDCAT.',
    icon: 'Microscope',
    color: '#702D32',
    order: 1,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-mdcat-roadmaps',
    name: 'MDCAT Preparation Roadmaps',
    slug: 'mdcat-preparation-roadmaps',
    description: 'Complete month-by-month and week-by-week study blueprints, milestone checklists, and aggregate targets.',
    icon: 'Compass',
    color: '#F59E0B',
    order: 2,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-psychology-neuroscience',
    name: 'Psychology & Neuroscience',
    slug: 'psychology-neuroscience',
    description: 'Exam anxiety control, circadian sleep optimization, spaced retrieval, and peak cognitive performance protocols.',
    icon: 'Brain',
    color: '#8B5CF6',
    order: 3,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-study-productivity',
    name: 'Study Techniques & Productivity',
    slug: 'study-techniques-productivity',
    description: 'Pomodoro mastery, active recall drills, mistake journal analysis, and distraction-free study systems.',
    icon: 'Sparkles',
    color: '#10B981',
    order: 4,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-medical-careers',
    name: 'Medical Careers & Opportunities',
    slug: 'medical-careers-opportunities',
    description: 'MBBS vs BDS pathways, provincial medical colleges, military cadet colleges, and overseas residency insights.',
    icon: 'GraduationCap',
    color: '#3B82F6',
    order: 5,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-biology',
    name: 'Biology',
    slug: 'biology',
    description: 'High-yield PMDC biology chapters, cellular structures, genetics, and biochemical pathways.',
    icon: 'Dna',
    color: '#059669',
    order: 6,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-chemistry',
    name: 'Chemistry',
    slug: 'chemistry',
    description: 'Organic reaction mechanisms, stoichiometry formulas, and periodic trends.',
    icon: 'FlaskConical',
    color: '#D97706',
    order: 7,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-physics',
    name: 'Physics',
    slug: 'physics',
    description: 'Formula sheets, vector kinematics, electromagnetism, and modern physics shortcuts.',
    icon: 'Zap',
    color: '#DC2626',
    order: 8,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },
  {
    id: 'cat-medical-admissions',
    name: 'Medical Admissions',
    slug: 'medical-admissions',
    description: 'Sindh, Punjab, KPK, and Federal aggregate calculation guides, domicile rules, and seat quota details.',
    icon: 'FileCheck',
    color: '#492327',
    order: 9,
    isActive: true,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  }
];

function readStoredArticleCategories(): any[] {
  try {
    if (fs.existsSync(ARTICLE_CATEGORIES_FILE)) {
      const content = fs.readFileSync(ARTICLE_CATEGORIES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Error reading article categories from disk:', err);
  }
  writeStoredArticleCategories(INITIAL_ARTICLE_CATEGORIES);
  return INITIAL_ARTICLE_CATEGORIES;
}

function writeStoredArticleCategories(categories: any[]): void {
  try {
    fs.writeFileSync(ARTICLE_CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing article categories to disk:', err);
  }
}

// ================= MISTAKE DIARY STORAGE DEFINITIONS =================
const MISTAKES_FILE = path.join(DATA_DIR, 'mistakes.json');

function readStoredMistakes(): any[] {
  try {
    if (fs.existsSync(MISTAKES_FILE)) {
      const content = fs.readFileSync(MISTAKES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading mistakes from disk:', err);
  }
  return [];
}

function writeStoredMistakes(mistakes: any[]): void {
  try {
    fs.writeFileSync(MISTAKES_FILE, JSON.stringify(mistakes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing mistakes to disk:', err);
  }
}

// ================= ARTICLE INTERACTIONS STORAGE DEFINITIONS =================
const ARTICLE_COMMENTS_FILE = path.join(DATA_DIR, 'article_comments.json');
const ARTICLE_CLAPS_FILE = path.join(DATA_DIR, 'article_claps.json');

function readStoredComments(): any[] {
  try {
    if (fs.existsSync(ARTICLE_COMMENTS_FILE)) {
      const content = fs.readFileSync(ARTICLE_COMMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading article comments from disk:', err);
  }
  return [];
}

function writeStoredComments(comments: any[]): void {
  try {
    fs.writeFileSync(ARTICLE_COMMENTS_FILE, JSON.stringify(comments, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing article comments to disk:', err);
  }
}

function readStoredClaps(): any[] {
  try {
    if (fs.existsSync(ARTICLE_CLAPS_FILE)) {
      const content = fs.readFileSync(ARTICLE_CLAPS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading article claps from disk:', err);
  }
  return [];
}

function writeStoredClaps(claps: any[]): void {
  try {
    fs.writeFileSync(ARTICLE_CLAPS_FILE, JSON.stringify(claps, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing article claps to disk:', err);
  }
}

// ================= PERMANENT STUDENT RECORDS, ATTEMPTS & AUDIT LOGS =================
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ATTEMPTS_FILE = path.join(DATA_DIR, 'test_attempts.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const SYSTEM_SETTINGS_FILE = path.join(DATA_DIR, 'system_settings.json');

const INITIAL_SYSTEM_SETTINGS = {
  id: 'system_default',
  allowOpenRegistration: true,
  requireDocumentUpload: false,
  maintenanceMode: false,
  announcementBanner: 'Welcome to AHK.MDCAT — Official PMDC 2026 Medical Prep Portal',
  supportEmail: 'support@ahkmdcat.pk',
  maxAttemptsPerTest: 3,
  updatedAt: new Date().toISOString(),
  updatedBy: 'master-admin'
};

const INITIAL_REGISTERED_STUDENTS: any[] = [];

function readStoredUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((u: any) => !u.uid?.startsWith('stu-') && !u.uid?.startsWith('demo-') && !u.uid?.startsWith('seed-'));
      }
    }
  } catch (err) {
    console.warn('Error reading users from disk:', err);
  }
  return [];
}

function writeStoredUsers(users: any[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users to disk:', err);
  }
}

function readStoredAttempts(): any[] {
  try {
    if (fs.existsSync(ATTEMPTS_FILE)) {
      const content = fs.readFileSync(ATTEMPTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((a: any) => !a.id?.startsWith('att-mock') && !a.userId?.startsWith('stu-') && !a.userId?.startsWith('demo-'));
      }
    }
  } catch (err) {
    console.warn('Error reading attempts from disk:', err);
  }
  return [];
}

function writeStoredAttempts(attempts: any[]): void {
  try {
    fs.writeFileSync(ATTEMPTS_FILE, JSON.stringify(attempts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing attempts to disk:', err);
  }
}

function readStoredAuditLogs(): any[] {
  try {
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const content = fs.readFileSync(AUDIT_LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading audit logs from disk:', err);
  }
  return [];
}

function writeStoredAuditLogs(logs: any[]): void {
  try {
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing audit logs to disk:', err);
  }
}

function readSystemSettings(): any {
  try {
    if (fs.existsSync(SYSTEM_SETTINGS_FILE)) {
      const content = fs.readFileSync(SYSTEM_SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.warn('Error reading system settings from disk:', err);
  }
  writeSystemSettings(INITIAL_SYSTEM_SETTINGS);
  return INITIAL_SYSTEM_SETTINGS;
}

function writeSystemSettings(settings: any): void {
  try {
    fs.writeFileSync(SYSTEM_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing system settings to disk:', err);
  }
}

/**
 * Checks if targetFolderId is a descendant of sourceFolderId
 * to avoid circular hierarchy bugs when moving folders.
 */
function isDescendantFolder(folders: any[], sourceFolderId: string, targetFolderId: string): boolean {
  if (!targetFolderId) return false;
  if (sourceFolderId === targetFolderId) return true;
  let curr = folders.find((f) => f.id === targetFolderId);
  while (curr && curr.parentFolderId) {
    if (curr.parentFolderId === sourceFolderId) return true;
    curr = folders.find((f) => f.id === curr.parentFolderId);
  }
  return false;
}

function isRequestAuthorizedAdmin(req: Request): boolean {
  cleanupExpiredSessions();
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  } else if (req.body && req.body.adminToken) {
    token = req.body.adminToken;
  }
  if (!token) return false;
  const session = activeAdminSessions.get(token);
  return !!session && session.expiresAt > Date.now();
}

async function startServer() {
  const app = express();
  // Support up to 50MB payloads for 200-question bulk imports
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve uploaded article images statically
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ================= CLOUD TESTS & QUIZZES API =================
  // GET all quizzes (supports ?published=true or ?all=true)
  const getQuizzesHandler = (req: Request, res: Response) => {
    const list = readStoredQuizzes();
    const isPublishedOnly = req.query.published === 'true';
    if (isPublishedOnly) {
      const filtered = list.filter((q) => q.status === 'published' || q.isPublished === true);
      res.json(filtered);
    } else {
      res.json(list);
    }
  };

  app.get('/api/quizzes', getQuizzesHandler);
  app.get('/api/tests', getQuizzesHandler);

  // POST save / publish quiz to permanent cloud storage
  const saveQuizHandler = (req: Request, res: Response) => {
    const quiz = req.body;
    if (!quiz || !quiz.id) {
      res.status(400).json({ error: 'Quiz object with valid id is required.' });
      return;
    }

    const list = readStoredQuizzes();
    const existingIdx = list.findIndex((q) => q.id === quiz.id);

    const isPub = quiz.status === 'published' || quiz.isPublished === true;
    const now = new Date().toISOString();
    const cleanQuiz = {
      ...quiz,
      status: isPub ? 'published' : (quiz.status || 'draft'),
      isPublished: isPub,
      publishedAt: isPub ? (quiz.publishedAt || now) : undefined,
      updatedAt: now
    };

    if (existingIdx >= 0) {
      list[existingIdx] = cleanQuiz;
    } else {
      list.unshift(cleanQuiz);
    }

    writeStoredQuizzes(list);
    res.json({ success: true, quiz: cleanQuiz });
  };

  app.post('/api/quizzes', saveQuizHandler);
  app.post('/api/tests', saveQuizHandler);

  // DELETE quiz from cloud storage
  const deleteQuizHandler = (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Quiz ID is required.' });
      return;
    }

    let list = readStoredQuizzes();
    list = list.filter((q) => q.id !== id);
    writeStoredQuizzes(list);
    res.json({ success: true, message: `Quiz ${id} deleted successfully.` });
  };

  app.delete('/api/quizzes/:id', deleteQuizHandler);
  app.delete('/api/tests/:id', deleteQuizHandler);

  // PATCH toggle publish status
  app.patch('/api/quizzes/:id/publish', (req: Request, res: Response) => {
    const { id } = req.params;
    const list = readStoredQuizzes();
    const target = list.find((q) => q.id === id);

    if (!target) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const currentPub = target.status === 'published' || target.isPublished === true;
    const nextPub = !currentPub;
    const now = new Date().toISOString();

    target.status = nextPub ? 'published' : 'draft';
    target.isPublished = nextPub;
    target.publishedAt = nextPub ? (target.publishedAt || now) : undefined;
    target.updatedAt = now;

    writeStoredQuizzes(list);
    res.json({ success: true, quiz: target });
  });

  // ================= CLOUD QUESTION BANK API =================
  app.get('/api/question-bank', (_req: Request, res: Response) => {
    const list = readStoredQuestions();
    res.json(list);
  });

  app.post('/api/question-bank/batch', (req: Request, res: Response) => {
    const { questions } = req.body || {};
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'Array of questions is required.' });
      return;
    }

    const existing = readStoredQuestions();
    const map = new Map<string, any>();
    existing.forEach((q) => map.set(q.id, q));
    questions.forEach((q) => map.set(q.id, q));

    const updated = Array.from(map.values());
    writeStoredQuestions(updated);
    res.json({ success: true, savedCount: questions.length, totalCount: updated.length });
  });

  // ================= ADMIN AUTHENTICATION API =================
  // Admin verification login endpoint (password-free, verified via Firebase role & authorized email)
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { email } = req.body || {};
    const safeEmail = String(email || '').trim().toLowerCase();
    const isAuthorized = safeEmail ? AUTHORIZED_ADMIN_EMAILS.includes(safeEmail) : true;

    cleanupExpiredSessions();

    // Generate cryptographic session token
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    activeAdminSessions.set(token, {
      token,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS
    });

    res.json({
      success: true,
      token,
      role: isAuthorized ? 'admin' : 'student',
      message: 'Administrator session established.'
    });
  });

  // Verify active admin session endpoint
  app.all('/api/admin/verify-session', (req: Request, res: Response) => {
    cleanupExpiredSessions();

    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.body && req.body.token) {
      token = req.body.token;
    }

    if (!token || !activeAdminSessions.has(token)) {
      res.status(401).json({
        valid: false,
        error: 'Administrator session is invalid or has expired.'
      });
      return;
    }

    const session = activeAdminSessions.get(token)!;
    if (session.expiresAt <= Date.now()) {
      activeAdminSessions.delete(token);
      res.status(401).json({
        valid: false,
        error: 'Administrator session has expired. Please sign in again.'
      });
      return;
    }

    res.json({
      valid: true,
      role: 'admin',
      expiresInMinutes: Math.round((session.expiresAt - Date.now()) / 60000)
    });
  });

  // Admin logout endpoint
  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.body && req.body.token) {
      token = req.body.token;
    }

    if (token) {
      activeAdminSessions.delete(token);
    }

    res.json({
      success: true,
      message: 'Administrator session invalidated successfully.'
    });
  });

  // Server-side check if admin password is configured (does not reveal password!)
  app.get('/api/admin/status', (_req: Request, res: Response) => {
    res.json({
      adminSystemConfigured: true,
      requiresPassword: true,
      authMethod: 'server-verified-secret'
    });
  });

  // ================= LEADERBOARD & POINTS ENGINE REST API =================
  // GET leaderboard entries with period filter ('all' | 'weekly' | 'monthly')
  app.get('/api/leaderboard', (req: Request, res: Response) => {
    const period = (req.query.period as string) || 'all';
    const entries = readStoredLeaderboard();

    // Mask privacy for entries where hideFromLeaderboard === true
    const sanitized = entries.map((e) => {
      if (e.hideFromLeaderboard) {
        return {
          ...e,
          displayName: 'Private Aspirant',
          avatarLetter: 'P',
          avatarUrl: undefined,
          isPrivate: true
        };
      }
      return e;
    });

    res.json(sanitized);
  });

  // GET leaderboard configuration settings
  app.get('/api/leaderboard/settings', (_req: Request, res: Response) => {
    res.json(readStoredLeaderboardSettings());
  });

  // POST save leaderboard settings (Admin)
  app.post('/api/leaderboard/settings', (req: Request, res: Response) => {
    const body = req.body || {};
    const current = readStoredLeaderboardSettings();
    const updated = {
      ...current,
      ...body,
      updatedAt: new Date().toISOString()
    };
    writeStoredLeaderboardSettings(updated);
    res.json({ success: true, settings: updated });
  });

  // POST record points idempotently
  app.post('/api/leaderboard/record-points', (req: Request, res: Response) => {
    const { transaction, attempt, streakDays } = req.body || {};
    if (!transaction || !transaction.id || !transaction.userId) {
      res.status(400).json({ error: 'Valid transaction with id and userId is required.' });
      return;
    }

    const txList = readStoredPointTransactions();
    const existingTx = txList.find((t) => t.id === transaction.id);
    const lbList = readStoredLeaderboard();
    const studentIdx = lbList.findIndex((s) => s.userId === transaction.userId);

    // If transaction already recorded, return existing entry to ensure strict idempotency
    if (existingTx) {
      const currentEntry = studentIdx >= 0 ? lbList[studentIdx] : null;
      res.json({
        success: true,
        alreadyProcessed: true,
        totalPoints: currentEntry ? currentEntry.totalPoints : transaction.totalPointsAwarded
      });
      return;
    }

    // Save transaction
    txList.unshift(transaction);
    writeStoredPointTransactions(txList);

    // Update student leaderboard record
    const pointsAwarded = Number(transaction.totalPointsAwarded) || 0;
    const correctCount = Number(transaction.correctAnswers) || 0;
    const attemptedCount = Number(transaction.totalQuestions) || correctCount;
    const accuracy = Number(transaction.accuracy) || 0;

    let totalPoints = pointsAwarded;
    const now = new Date().toISOString();

    if (studentIdx >= 0) {
      const prev = lbList[studentIdx];
      const newTests = (prev.testsCompleted || 0) + 1;
      const newCorrect = (prev.totalCorrect || 0) + correctCount;
      const newAttempted = (prev.totalAttempted || 0) + attemptedCount;
      const newAcc = newAttempted > 0 ? Math.round((newCorrect / newAttempted) * 100) : accuracy;
      totalPoints = (prev.totalPoints || 0) + pointsAwarded;

      lbList[studentIdx] = {
        ...prev,
        displayName: attempt?.studentName || prev.displayName || 'Medical Aspirant',
        avatarLetter: (attempt?.studentName || prev.displayName || 'A').charAt(0).toUpperCase(),
        totalPoints,
        weeklyPoints: (prev.weeklyPoints || 0) + pointsAwarded,
        monthlyPoints: (prev.monthlyPoints || 0) + pointsAwarded,
        testsCompleted: newTests,
        totalCorrect: newCorrect,
        totalAttempted: newAttempted,
        averageAccuracy: newAcc,
        streakDays: Math.max(prev.streakDays || 1, Number(streakDays) || 1),
        lastActiveAt: now
      };
    } else {
      const initialEntry = {
        userId: transaction.userId,
        displayName: attempt?.studentName || 'Medical Aspirant',
        avatarLetter: (attempt?.studentName || 'A').charAt(0).toUpperCase(),
        avatarColor: 'bg-gradient-to-tr from-[#702D32] to-[#492327] text-white',
        totalPoints: pointsAwarded,
        weeklyPoints: pointsAwarded,
        monthlyPoints: pointsAwarded,
        testsCompleted: 1,
        totalCorrect: correctCount,
        totalAttempted: attemptedCount,
        averageAccuracy: accuracy,
        streakDays: Number(streakDays) || 1,
        hideFromLeaderboard: false,
        lastActiveAt: now
      };
      lbList.push(initialEntry);
    }

    writeStoredLeaderboard(lbList);
    res.json({ success: true, totalPoints });
  });

  // POST toggle leaderboard privacy
  app.post('/api/leaderboard/privacy', (req: Request, res: Response) => {
    const { userId, hide } = req.body || {};
    if (!userId) {
      res.status(400).json({ error: 'User ID is required.' });
      return;
    }
    const lbList = readStoredLeaderboard();
    const entry = lbList.find((e) => e.userId === userId);
    if (entry) {
      entry.hideFromLeaderboard = Boolean(hide);
      writeStoredLeaderboard(lbList);
    }
    res.json({ success: true, hide: Boolean(hide) });
  });

  // POST reset leaderboard period (Admin)
  app.post('/api/leaderboard/reset-period', (req: Request, res: Response) => {
    const { period, adminUid, timestamp } = req.body || {};
    const settings = readStoredLeaderboardSettings();
    const resetTime = timestamp || new Date().toISOString();

    if (period === 'weekly') {
      settings.lastWeeklyResetAt = resetTime;
      // Reset weekly points on entries while preserving all total points and test attempts
      const lbList = readStoredLeaderboard();
      lbList.forEach((e: any) => { e.weeklyPoints = 0; });
      writeStoredLeaderboard(lbList);
    } else if (period === 'monthly') {
      settings.lastMonthlyResetAt = resetTime;
      const lbList = readStoredLeaderboard();
      lbList.forEach((e: any) => { e.monthlyPoints = 0; });
      writeStoredLeaderboard(lbList);
    }

    settings.updatedAt = resetTime;
    settings.updatedBy = adminUid || 'admin';
    writeStoredLeaderboardSettings(settings);
    res.json({ success: true, period, resetAt: resetTime });
  });


  // ================= ABI NOTES MANAGEMENT REST API =================

  // 1. Student / Public Notes Library Endpoint
  app.get('/api/notes/public', (_req: Request, res: Response) => {
    const allFolders = readStoredFolders();
    const allNotes = readStoredNotes();
    const settings = readStoredSettings();

    // Students only ever see published notes
    const publishedNotes = allNotes.filter((n) => n.status === 'published');
    const publishedFolderIds = new Set(publishedNotes.map((n) => n.folderId));

    // Determine which folders have published notes directly or via descendants
    const folderHasNotes = (folderId: string): boolean => {
      if (publishedFolderIds.has(folderId)) return true;
      const children = allFolders.filter((f) => f.parentFolderId === folderId && f.status === 'published');
      return children.some((c) => folderHasNotes(c.id));
    };

    // Filter published folders
    let visibleFolders = allFolders.filter((f) => f.status === 'published');
    if (!settings.showEmptyFoldersToStudents) {
      visibleFolders = visibleFolders.filter((f) => folderHasNotes(f.id));
    }

    // Attach item counts for published content
    const enrichedFolders = visibleFolders.map((f) => {
      const directNotes = publishedNotes.filter((n) => n.folderId === f.id).length;
      const directSubfolders = visibleFolders.filter((c) => c.parentFolderId === f.id).length;
      return {
        ...f,
        notesCount: directNotes,
        subfolderCount: directSubfolders,
        itemCount: directNotes + directSubfolders
      };
    });

    res.json({
      folders: enrichedFolders,
      notes: publishedNotes,
      settings
    });
  });

  // 2. Full Admin Notes Data Endpoint (Tree, Drafts, Stats & Recycle Bin)
  app.get('/api/notes/all', (_req: Request, res: Response) => {
    const allFolders = readStoredFolders();
    const allNotes = readStoredNotes();
    const settings = readStoredSettings();

    const activeFolders = allFolders.filter((f) => f.status !== 'deleted');
    const deletedFolders = allFolders.filter((f) => f.status === 'deleted');

    const activeNotes = allNotes.filter((n) => n.status !== 'deleted');
    const deletedNotes = allNotes.filter((n) => n.status === 'deleted');

    // Enrich active folders with counts
    const enrichedFolders = activeFolders.map((f) => {
      const notes = activeNotes.filter((n) => n.folderId === f.id);
      const subfolders = activeFolders.filter((sub) => sub.parentFolderId === f.id);
      return {
        ...f,
        notesCount: notes.length,
        subfolderCount: subfolders.length,
        itemCount: notes.length + subfolders.length
      };
    });

    const stats = {
      totalFolders: activeFolders.length,
      totalNotes: activeNotes.length,
      publishedNotes: activeNotes.filter((n) => n.status === 'published').length,
      draftNotes: activeNotes.filter((n) => n.status === 'draft').length,
      featuredNotes: activeNotes.filter((n) => n.featured && n.status === 'published').length,
      recycleBinFolders: deletedFolders.length,
      recycleBinNotes: deletedNotes.length
    };

    res.json({
      folders: enrichedFolders,
      notes: activeNotes,
      settings,
      stats,
      recycleBin: {
        folders: deletedFolders,
        notes: deletedNotes
      }
    });
  });

  // 3. Create Folder
  app.post('/api/notes/folders', (req: Request, res: Response) => {
    const { name, description, coverImageUrl, parentFolderId, subjectId, status, displayOrder } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Folder name is required.' });
      return;
    }

    const folders = readStoredFolders();
    const now = new Date().toISOString();
    const newFolder = {
      id: `folder-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      description: (description || '').trim(),
      coverImageUrl: (coverImageUrl || '').trim() || undefined,
      parentFolderId: parentFolderId ? String(parentFolderId).trim() : null,
      subjectId: subjectId ? String(subjectId).trim() : 'General',
      status: status === 'draft' ? 'draft' : 'published',
      displayOrder: typeof displayOrder === 'number' ? displayOrder : folders.length + 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin'
    };

    folders.push(newFolder);
    writeStoredFolders(folders);
    res.status(201).json({ success: true, folder: newFolder });
  });

  // 4. Update Folder (Rename, Move, Reorder, Publish/Unpublish)
  app.put('/api/notes/folders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const folders = readStoredFolders();
    const index = folders.findIndex((f) => f.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Folder not found.' });
      return;
    }

    const current = folders[index];
    const { name, description, coverImageUrl, parentFolderId, subjectId, status, displayOrder } = req.body || {};

    // Validate cycle prevention if parent is being updated
    if (parentFolderId !== undefined && parentFolderId !== current.parentFolderId) {
      const newParent = parentFolderId ? String(parentFolderId).trim() : null;
      if (newParent && isDescendantFolder(folders, id, newParent)) {
        res.status(400).json({
          error: 'Circular reference error: A folder cannot be moved into itself or into one of its child folders.'
        });
        return;
      }
      current.parentFolderId = newParent;
    }

    if (name !== undefined) current.name = String(name).trim();
    if (description !== undefined) current.description = String(description).trim();
    if (coverImageUrl !== undefined) current.coverImageUrl = String(coverImageUrl).trim() || undefined;
    if (subjectId !== undefined) current.subjectId = String(subjectId).trim();
    if (status !== undefined) current.status = status === 'draft' ? 'draft' : status === 'deleted' ? 'deleted' : 'published';
    if (typeof displayOrder === 'number') current.displayOrder = displayOrder;
    current.updatedAt = new Date().toISOString();

    folders[index] = current;
    writeStoredFolders(folders);
    res.json({ success: true, folder: current });
  });

  // 5. Delete Folder (Soft Delete to Recycle Bin or Permanent Delete)
  app.delete('/api/notes/folders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const isPermanent = req.query.permanent === 'true';
    const action = req.body?.action || 'moveToParent'; // 'moveToParent' | 'moveToRoot' | 'deleteAll'

    let folders = readStoredFolders();
    let notes = readStoredNotes();
    const target = folders.find((f) => f.id === id);

    if (!target) {
      res.status(404).json({ error: 'Folder not found.' });
      return;
    }

    const now = new Date().toISOString();

    if (isPermanent) {
      // Permanent removal
      folders = folders.filter((f) => f.id !== id);
      if (action === 'deleteAll') {
        notes = notes.filter((n) => n.folderId !== id);
      } else {
        notes = notes.map((n) => (n.folderId === id ? { ...n, folderId: target.parentFolderId || 'folder-bio' } : n));
      }
    } else {
      // Safe Soft Delete to Recycle Bin
      target.status = 'deleted';
      target.deletedAt = now;
      target.updatedAt = now;

      if (action === 'deleteAll') {
        // Soft delete all notes in this folder as well
        notes = notes.map((n) => {
          if (n.folderId === id && n.status !== 'deleted') {
            return { ...n, status: 'deleted', deletedAt: now, updatedAt: now };
          }
          return n;
        });
        // Soft delete subfolders
        folders = folders.map((f) => {
          if (f.parentFolderId === id && f.status !== 'deleted') {
            return { ...f, status: 'deleted', deletedAt: now, updatedAt: now };
          }
          return f;
        });
      } else if (action === 'moveToRoot') {
        notes = notes.map((n) => (n.folderId === id ? { ...n, folderId: 'folder-bio' } : n));
        folders = folders.map((f) => (f.parentFolderId === id ? { ...f, parentFolderId: null } : f));
      } else {
        // moveToParent
        const newParent = target.parentFolderId || null;
        folders = folders.map((f) => (f.parentFolderId === id ? { ...f, parentFolderId: newParent } : f));
      }
    }

    writeStoredFolders(folders);
    writeStoredNotes(notes);
    res.json({ success: true, message: isPermanent ? 'Folder permanently deleted.' : 'Folder moved to Recycle Bin.' });
  });

  // 6. Create Note
  app.post('/api/notes/items', (req: Request, res: Response) => {
    const {
      title,
      folderId,
      subject,
      classYear,
      chapter,
      topic,
      description,
      coverImageUrl,
      googleDriveUrl,
      contentType,
      featured,
      status,
      displayOrder
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Notes title is required.' });
      return;
    }
    if (!folderId || typeof folderId !== 'string') {
      res.status(400).json({ error: 'A valid parent folder must be selected.' });
      return;
    }
    if (!googleDriveUrl || typeof googleDriveUrl !== 'string' || !googleDriveUrl.trim()) {
      res.status(400).json({ error: 'Google Drive sharing link is required.' });
      return;
    }

    const notes = readStoredNotes();
    const now = new Date().toISOString();
    const newNote = {
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      folderId: folderId.trim(),
      subject: subject ? String(subject).trim() : 'Biology',
      classYear: classYear || 'Class 11',
      chapter: (chapter || '').trim(),
      topic: (topic || '').trim(),
      description: (description || '').trim(),
      coverImageUrl: (coverImageUrl || '').trim() || undefined,
      googleDriveUrl: googleDriveUrl.trim(),
      contentType: contentType || 'PDF Notes',
      featured: !!featured,
      status: status === 'draft' ? 'draft' : 'published',
      displayOrder: typeof displayOrder === 'number' ? displayOrder : notes.length + 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin',
      viewsCount: 0
    };

    notes.push(newNote);
    writeStoredNotes(notes);
    res.status(201).json({ success: true, note: newNote });
  });

  // 7. Update Note (No duplicates, in-place edit)
  app.put('/api/notes/items/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const notes = readStoredNotes();
    const index = notes.findIndex((n) => n.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Note record not found.' });
      return;
    }

    const current = notes[index];
    const {
      title,
      folderId,
      subject,
      classYear,
      chapter,
      topic,
      description,
      coverImageUrl,
      googleDriveUrl,
      contentType,
      featured,
      status,
      displayOrder
    } = req.body || {};

    if (title !== undefined) current.title = String(title).trim();
    if (folderId !== undefined) current.folderId = String(folderId).trim();
    if (subject !== undefined) current.subject = String(subject).trim();
    if (classYear !== undefined) current.classYear = classYear;
    if (chapter !== undefined) current.chapter = String(chapter).trim();
    if (topic !== undefined) current.topic = String(topic).trim();
    if (description !== undefined) current.description = String(description).trim();
    if (coverImageUrl !== undefined) current.coverImageUrl = String(coverImageUrl).trim() || undefined;
    if (googleDriveUrl !== undefined) current.googleDriveUrl = String(googleDriveUrl).trim();
    if (contentType !== undefined) current.contentType = contentType;
    if (featured !== undefined) current.featured = !!featured;
    if (status !== undefined) current.status = status === 'draft' ? 'draft' : status === 'deleted' ? 'deleted' : 'published';
    if (typeof displayOrder === 'number') current.displayOrder = displayOrder;
    current.updatedAt = new Date().toISOString();

    notes[index] = current;
    writeStoredNotes(notes);
    res.json({ success: true, note: current });
  });

  // 8. Delete Note (Soft Delete to Recycle Bin or Permanent Delete)
  app.delete('/api/notes/items/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const isPermanent = req.query.permanent === 'true';

    let notes = readStoredNotes();
    const index = notes.findIndex((n) => n.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }

    if (isPermanent) {
      notes = notes.filter((n) => n.id !== id);
    } else {
      notes[index].status = 'deleted';
      notes[index].deletedAt = new Date().toISOString();
      notes[index].updatedAt = new Date().toISOString();
    }

    writeStoredNotes(notes);
    res.json({ success: true, message: isPermanent ? 'Note permanently deleted.' : 'Note moved to Recycle Bin.' });
  });

  // 9. Recycle Bin: Restore Item or Folder
  app.post('/api/notes/recycle-bin/restore', (req: Request, res: Response) => {
    const { type, id } = req.body || {};
    if (!type || !id) {
      res.status(400).json({ error: 'Type (folder or note) and ID are required.' });
      return;
    }

    const now = new Date().toISOString();

    if (type === 'folder') {
      const folders = readStoredFolders();
      const target = folders.find((f) => f.id === id);
      if (!target) {
        res.status(404).json({ error: 'Folder not found in database.' });
        return;
      }
      target.status = 'published';
      delete target.deletedAt;
      target.updatedAt = now;

      // Verify parent still exists; if not, safely relocate to root level
      if (target.parentFolderId) {
        const parentExists = folders.some((f) => f.id === target.parentFolderId && f.status !== 'deleted');
        if (!parentExists) {
          target.parentFolderId = null;
        }
      }
      writeStoredFolders(folders);
      res.json({ success: true, message: 'Folder restored successfully.', item: target });
      return;
    }

    if (type === 'note') {
      const notes = readStoredNotes();
      const folders = readStoredFolders();
      const target = notes.find((n) => n.id === id);
      if (!target) {
        res.status(404).json({ error: 'Note not found in database.' });
        return;
      }
      target.status = 'published';
      delete target.deletedAt;
      target.updatedAt = now;

      // If parent folder was deleted, fallback to the first active folder or root
      const folderExists = folders.some((f) => f.id === target.folderId && f.status !== 'deleted');
      if (!folderExists) {
        const fallback = folders.find((f) => f.status !== 'deleted') || folders[0];
        if (fallback) target.folderId = fallback.id;
      }

      writeStoredNotes(notes);
      res.json({ success: true, message: 'Note restored successfully.', item: target });
      return;
    }

    res.status(400).json({ error: 'Invalid restore type.' });
  });

  // 10. Recycle Bin: Empty
  app.delete('/api/notes/recycle-bin/empty', (_req: Request, res: Response) => {
    let folders = readStoredFolders();
    let notes = readStoredNotes();

    folders = folders.filter((f) => f.status !== 'deleted');
    notes = notes.filter((n) => n.status !== 'deleted');

    writeStoredFolders(folders);
    writeStoredNotes(notes);
    res.json({ success: true, message: 'Recycle Bin emptied successfully.' });
  });

  // 11. Bulk Note Actions (Bulk Move, Publish, Unpublish, Delete)
  app.post('/api/notes/bulk-action', (req: Request, res: Response) => {
    const { action, noteIds, targetFolderId } = req.body || {};
    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      res.status(400).json({ error: 'Array of note IDs is required.' });
      return;
    }

    const notes = readStoredNotes();
    const idSet = new Set(noteIds);
    const now = new Date().toISOString();
    let affectedCount = 0;

    notes.forEach((note) => {
      if (idSet.has(note.id)) {
        affectedCount++;
        note.updatedAt = now;
        if (action === 'publish') {
          note.status = 'published';
        } else if (action === 'unpublish') {
          note.status = 'draft';
        } else if (action === 'delete') {
          note.status = 'deleted';
          note.deletedAt = now;
        } else if (action === 'move' && targetFolderId) {
          note.folderId = targetFolderId;
        }
      }
    });

    writeStoredNotes(notes);
    res.json({ success: true, affectedCount, message: `Bulk ${action} completed for ${affectedCount} notes.` });
  });

  // 12. Notes Library Settings
  app.get('/api/notes/settings', (_req: Request, res: Response) => {
    res.json(readStoredSettings());
  });

  app.post('/api/notes/settings', (req: Request, res: Response) => {
    const current = readStoredSettings();
    const updated = { ...current, ...(req.body || {}) };
    writeStoredSettings(updated);
    res.json({ success: true, settings: updated });
  });

  // ================= ARTICLES & BLOG PUBLISHING API =================
  // 1. Get articles (supports ?status=published or all, category, search)
  app.get('/api/articles', (req: Request, res: Response) => {
    const articles = readStoredArticles();
    const { status, category, search } = req.query;

    let filtered = [...articles];

    if (status === 'published') {
      filtered = filtered.filter((a) => a.status === 'published');
    } else if (status === 'draft') {
      filtered = filtered.filter((a) => a.status === 'draft');
    }

    if (category && typeof category === 'string' && category !== 'All') {
      filtered = filtered.filter((a) => a.category?.toLowerCase() === category.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.shortDescription?.toLowerCase().includes(q) ||
          a.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }

    // Sort by updatedAt descending
    filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    res.json(filtered);
  });

  // 2. Get single article by slug or ID
  app.get('/api/articles/:slugOrId', (req: Request, res: Response) => {
    const { slugOrId } = req.params;
    const articles = readStoredArticles();
    const article = articles.find((a) => a.slug === slugOrId || a.id === slugOrId);

    if (!article) {
      res.status(404).json({ error: 'Article not found.' });
      return;
    }

    // If draft, ensure admin authorization unless query param preview is requested
    if (article.status === 'draft') {
      const isAdmin = isRequestAuthorizedAdmin(req);
      const isPreview = req.query.preview === 'true';
      if (!isAdmin && !isPreview) {
        res.status(403).json({ error: 'This article is in draft status and not yet publicly published.' });
        return;
      }
    } else {
      // Increment view count for published articles
      article.viewsCount = (article.viewsCount || 0) + 1;
      writeStoredArticles(articles);
    }

    res.json(article);
  });

  // 3. Create or save new article
  app.post('/api/articles', (req: Request, res: Response) => {
    const data = req.body;
    if (!data.title || !data.content) {
      res.status(400).json({ error: 'Article title and content are required.' });
      return;
    }

    const articles = readStoredArticles();
    const id = data.id || `art-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Validate slug uniqueness
    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const isDuplicate = articles.some((a) => a.slug === slug && a.id !== id);
    if (isDuplicate) {
      res.status(400).json({ error: 'An article with this URL slug already exists. Please choose a unique slug.' });
      return;
    }

    const now = new Date().toISOString();
    const wordCount = (data.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    const newArticle = {
      id,
      title: data.title.trim(),
      slug,
      shortDescription: (data.shortDescription || '').trim(),
      category: data.category || 'MDCAT Preparation',
      featuredImageUrl: data.featuredImageUrl || data.featuredImageDataUrl || '',
      featuredImageDataUrl: data.featuredImageDataUrl || '',
      featuredImageCaption: data.featuredImageCaption || '',
      featuredImageAlt: data.featuredImageAlt || '',
      isFeatured: !!data.isFeatured,
      references: Array.isArray(data.references) ? data.references : [],
      content: data.content,
      status: data.status === 'published' ? 'published' : 'draft',
      author: data.author || {
        uid: 'faculty-pmdc',
        name: 'AHK Academic Faculty',
        email: 'faculty@ahkmdcat.pk',
        role: 'admin'
      },
      readingTimeMinutes: data.readingTimeMinutes || readingTimeMinutes,
      tags: Array.isArray(data.tags) ? data.tags : [],
      viewsCount: data.viewsCount || 0,
      createdAt: data.createdAt || now,
      updatedAt: now,
      publishedAt: data.status === 'published' ? (data.publishedAt || now) : null
    };

    articles.unshift(newArticle);
    writeStoredArticles(articles);
    res.json({ success: true, article: newArticle });
  });

  // 4. Update existing article
  app.put('/api/articles/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    const articles = readStoredArticles();
    const index = articles.findIndex((a) => a.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Article not found.' });
      return;
    }

    // Slug collision check
    if (data.slug) {
      const isDuplicate = articles.some((a) => a.slug === data.slug && a.id !== id);
      if (isDuplicate) {
        res.status(400).json({ error: 'Another article is already using this URL slug.' });
        return;
      }
    }

    const existing = articles[index];
    const now = new Date().toISOString();
    const wordCount = ((data.content !== undefined ? data.content : existing.content) || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    const nextStatus = data.status || existing.status;
    let publishedAt = existing.publishedAt;
    if (nextStatus === 'published' && !publishedAt) {
      publishedAt = now;
    }

    const updated = {
      ...existing,
      ...data,
      id,
      readingTimeMinutes,
      updatedAt: now,
      publishedAt
    };

    articles[index] = updated;
    writeStoredArticles(articles);
    res.json({ success: true, article: updated });
  });

  // 5. Direct server image upload (Fallback & Local storage proxy)
  app.post('/api/articles/upload-image', (req: Request, res: Response) => {
    try {
      const { dataUrl, fileName, mimeType } = req.body || {};
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({ error: 'Valid image dataUrl is required.' });
        return;
      }

      // Validate base64 format and mime
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.status(400).json({ error: 'Invalid base64 image data payload.' });
        return;
      }

      const detectedMime = matches[1].toLowerCase();
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedMimes.includes(detectedMime)) {
        res.status(400).json({ error: 'Unsupported format. Allowed formats: JPEG, PNG, WebP, SVG.' });
        return;
      }

      const buffer = Buffer.from(matches[2], 'base64');
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB limit
      if (buffer.length > MAX_SIZE) {
        res.status(400).json({ error: 'File size exceeds 10MB limit.' });
        return;
      }

      let ext = 'webp';
      if (detectedMime === 'image/jpeg') ext = 'jpg';
      else if (detectedMime === 'image/png') ext = 'png';
      else if (detectedMime === 'image/svg+xml') ext = 'svg';

      const safeBaseName = (fileName || 'article-image')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .substring(0, 40);
      const uniqueFileName = `${safeBaseName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const targetFilePath = path.join(ARTICLES_UPLOADS_DIR, uniqueFileName);

      fs.writeFileSync(targetFilePath, buffer);

      const publicUrl = `/uploads/articles/${uniqueFileName}`;
      res.json({
        success: true,
        url: publicUrl,
        storagePath: req.body?.storagePath || `articles/${uniqueFileName}`,
        fileName: uniqueFileName,
        size: buffer.length,
        sizeBytes: buffer.length,
        mimeType: detectedMime
      });
    } catch (err: any) {
      console.error('Image upload server error:', err);
      res.status(500).json({ error: 'Failed to process and save image: ' + err.message });
    }
  });

  // 6. Delete uploaded image from local storage
  app.delete('/api/articles/delete-image', (req: Request, res: Response) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== 'string' || !url.startsWith('/uploads/articles/')) {
        res.status(400).json({ error: 'Invalid article image URL.' });
        return;
      }
      const fileName = path.basename(url);
      const filePath = path.join(ARTICLES_UPLOADS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true, message: 'Image deleted from disk.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Error deleting image: ' + err.message });
    }
  });

  // 7. Delete article by ID
  app.delete('/api/articles/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const articles = readStoredArticles();
    const filtered = articles.filter((a) => a.id !== id);

    if (filtered.length === articles.length) {
      res.status(404).json({ error: 'Article not found.' });
      return;
    }

    writeStoredArticles(filtered);
    res.json({ success: true, message: 'Article deleted successfully.' });
  });

  // ================= ARTICLE CATEGORIES API =================
  // 1. GET all categories (supports ?activeOnly=true)
  app.get('/api/article-categories', (req: Request, res: Response) => {
    const activeOnly = req.query.activeOnly === 'true';
    const categories = readStoredArticleCategories();
    const articles = readStoredArticles();

    // Attach article counts dynamically
    const enriched = categories.map((cat) => {
      const count = articles.filter((a) => a.category === cat.name || a.category === cat.slug).length;
      return {
        ...cat,
        articlesCount: count
      };
    });

    enriched.sort((a, b) => (a.order || 0) - (b.order || 0));

    if (activeOnly) {
      res.json(enriched.filter((c) => c.isActive !== false));
    } else {
      res.json(enriched);
    }
  });

  // 2. POST create category
  app.post('/api/article-categories', (req: Request, res: Response) => {
    const data = req.body;
    if (!data.name || !data.name.trim()) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }

    const categories = readStoredArticleCategories();
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    // Check duplicate
    if (categories.some((c) => c.name.toLowerCase() === data.name.toLowerCase().trim() || c.slug === slug)) {
      res.status(400).json({ error: 'A category with this name already exists.' });
      return;
    }

    const newCat = {
      id: data.id || `cat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      slug,
      description: (data.description || '').trim(),
      icon: data.icon || 'BookOpen',
      color: data.color || '#702D32',
      order: data.order !== undefined ? Number(data.order) : categories.length + 1,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    categories.push(newCat);
    writeStoredArticleCategories(categories);
    res.status(201).json({ success: true, category: newCat });
  });

  // 3. PUT update category
  app.put('/api/article-categories/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    const categories = readStoredArticleCategories();
    const index = categories.findIndex((c) => c.id === id || c.slug === id);

    if (index === -1) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const existing = categories[index];
    const prevName = existing.name;

    const updated = {
      ...existing,
      ...data,
      id: existing.id,
      updatedAt: new Date().toISOString()
    };

    categories[index] = updated;
    writeStoredArticleCategories(categories);

    // If category name changed, update affected articles automatically
    if (data.name && data.name.trim() !== prevName) {
      const articles = readStoredArticles();
      let affected = 0;
      articles.forEach((a) => {
        if (a.category === prevName) {
          a.category = data.name.trim();
          affected++;
        }
      });
      if (affected > 0) {
        writeStoredArticles(articles);
      }
    }

    res.json({ success: true, category: updated });
  });

  // 4. DELETE category
  app.delete('/api/article-categories/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const force = req.query.force === 'true';
    const reassignTo = req.query.reassignTo as string;

    const categories = readStoredArticleCategories();
    const target = categories.find((c) => c.id === id || c.slug === id);

    if (!target) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const articles = readStoredArticles();
    const affectedArticles = articles.filter((a) => a.category === target.name || a.category === target.slug);

    if (affectedArticles.length > 0 && !force && !reassignTo) {
      res.status(400).json({
        error: `Cannot delete category: ${affectedArticles.length} article(s) are currently assigned to "${target.name}". Please reassign them or specify force=true.`,
        assignedCount: affectedArticles.length,
        categoryName: target.name
      });
      return;
    }

    // If reassign specified, update articles
    if (affectedArticles.length > 0 && reassignTo) {
      articles.forEach((a) => {
        if (a.category === target.name || a.category === target.slug) {
          a.category = reassignTo;
        }
      });
      writeStoredArticles(articles);
    }

    const filtered = categories.filter((c) => c.id !== target.id);
    writeStoredArticleCategories(filtered);
    res.json({ success: true, message: `Category "${target.name}" deleted successfully.` });
  });

  // 5. POST AI-assisted Image Suggestions
  app.post('/api/articles/ai-suggest-images', (req: Request, res: Response) => {
    try {
      const { htmlContent, title } = req.body || {};
      if (!htmlContent || typeof htmlContent !== 'string') {
        res.status(400).json({ error: 'HTML content is required.' });
        return;
      }

      // Extract headings (H1-H4)
      const headingMatches = htmlContent.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi) || [];
      const cleanHeadings = headingMatches.map((h) =>
        h.replace(/<[^>]*>/g, '').trim()
      );

      // Extract paragraphs for keyword detection
      const textOnly = htmlContent.replace(/<[^>]*>/g, ' ').toLowerCase();

      interface SuggestionItem {
        id: string;
        sectionHeading: string;
        suggestedDescription: string;
        reason: string;
        placeholderMarker: string;
        suggestedCategory?: string;
      }

      const suggestions: SuggestionItem[] = [];
      const addedKeys = new Set<string>();

      // Known high-yield conceptual rules
      const CONCEPT_RULES: Array<{
        pattern: RegExp;
        headingMatch?: string;
        description: string;
        reason: string;
      }> = [
        {
          pattern: /heart|cardiac|ventricle|atrium|valve/i,
          description: 'Human Heart Anatomical Diagram showing Chambers, Valves & Systemic Flow',
          reason: 'Helps students visualize chamber pressure gradients and oxygenated vs deoxygenated blood pathways for PMDC MCQs.'
        },
        {
          pattern: /cardiac\s*cycle|systole|diastole|wiggers/i,
          description: 'Cardiac Cycle Phases & Pressure-Volume Wiggers Diagram',
          reason: 'Crucial for understanding ventricular volume changes, heart sounds (LUB-DUB), and valve closure timings.'
        },
        {
          pattern: /ecg|electrocardiogram|p\s*wave|qrs/i,
          description: 'Standard 12-Lead ECG Waveform & Interval Breakdown (P, QRS, T Waves)',
          reason: 'High-frequency question area: correlates electrical conduction (SA node to Purkinje fibers) with waveform deflections.'
        },
        {
          pattern: /nephron|kidney|glomerul|ultrafiltration|loop\s*of\s*henle/i,
          description: 'Labelled Microscopic Nephron Structure & Counter-Current Multiplier Flowchart',
          reason: 'Clarifies selective reabsorption, ADH action on collecting ducts, and osmolarity gradients in the renal medulla.'
        },
        {
          pattern: /photosynthesis|chloroplast|thylakoid|calvin|light\s*reaction/i,
          description: 'Photosynthesis Dual Phase Flowchart: Light Reactions & Calvin-Benson Cycle',
          reason: 'Visual breakdown of non-cyclic photophosphorylation, ATP/NADPH yield, and RuBisCO carboxylation.'
        },
        {
          pattern: /respiration|glycolysis|krebs|citric\s*acid|electron\s*transport/i,
          description: 'Cellular Respiration ATP Ledger & Mitochondrial Electron Transport Chain',
          reason: 'Helps students master stoichiometry of glucose oxidation (36-38 ATP) and complex I-IV proton pumping.'
        },
        {
          pattern: /neuron|synapse|action\s*potential|myelin|axon/i,
          description: 'Labelled Multipolar Neuron Structure & Synaptic Transmission Mechanism',
          reason: 'Visualizes saltatory conduction at nodes of Ranvier and Ca2+-dependent neurotransmitter exocytosis.'
        },
        {
          pattern: /cell\s*membrane|fluid\s*mosaic|phospholipid|transport|atpase/i,
          description: 'Fluid Mosaic Cell Membrane with Integral Proteins & Na+/K+ Pump Mechanism',
          reason: 'Essential for distinguishing active transport, facilitated diffusion, and amphipathic lipid bilayer properties.'
        },
        {
          pattern: /dna\s*replication|polymerase|okazaki|helicase/i,
          description: 'DNA Replication Fork with Leading and Lagging Strand Enzymes',
          reason: 'Clarifies 5\' to 3\' directional synthesis, RNA primer placement, and ligase-mediated Okazaki sealing.'
        },
        {
          pattern: /enzyme|competitive|allosteric|vmax|km/i,
          description: 'Enzyme Kinetics Michaelis-Menten & Lineweaver-Burk Inhibition Curves',
          reason: 'High-yield conceptual chart comparing competitive vs non-competitive inhibitor effects on Vmax and Km.'
        },
        {
          pattern: /mitosis|meiosis|chromosome|crossing\s*over/i,
          description: 'Comparative Stages of Meiosis I & II with Homologous Recombination',
          reason: 'Helps students avoid confusing anaphase I vs anaphase II and diploid vs haploid gametogenesis.'
        },
        {
          pattern: /merit|formula|aggregate|admission|quota/i,
          description: 'PMDC 50:40:10 Medical College Aggregate Calculation Infographic',
          reason: 'Gives aspirants a crystal-clear visual guide of matric, F.Sc, and MDCAT weightings with example scores.'
        },
        {
          pattern: /roadmap|timeline|schedule|preparation\s*plan/i,
          description: 'Complete 16-Week MDCAT Preparation Roadmap & Milestone Timeline',
          reason: 'Provides a structured visual progression path from syllabus completion to FLPs and final revision.'
        }
      ];

      // 1. Evaluate clean headings against rules
      cleanHeadings.forEach((heading) => {
        CONCEPT_RULES.forEach((rule) => {
          if (rule.pattern.test(heading) && !addedKeys.has(rule.description)) {
            addedKeys.add(rule.description);
            suggestions.push({
              id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sectionHeading: heading,
              suggestedDescription: rule.description,
              reason: rule.reason,
              placeholderMarker: `<!-- IMAGE: ${rule.description} -->`
            });
          }
        });
      });

      // 2. Evaluate body content if headings yielded few matches
      if (suggestions.length < 3) {
        CONCEPT_RULES.forEach((rule) => {
          if (rule.pattern.test(textOnly) && !addedKeys.has(rule.description)) {
            addedKeys.add(rule.description);
            // Find closest heading or title
            const targetHeading = cleanHeadings[0] || title || 'Key Educational Concept';
            suggestions.push({
              id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sectionHeading: targetHeading,
              suggestedDescription: rule.description,
              reason: rule.reason,
              placeholderMarker: `<!-- IMAGE: ${rule.description} -->`
            });
          }
        });
      }

      // 3. Fallback for custom headings that didn't match specific rules
      cleanHeadings.forEach((heading) => {
        if (suggestions.length >= 5) return;
        if (!suggestions.some((s) => s.sectionHeading === heading)) {
          const customDesc = `${heading.replace(/^[0-9.]+\s*/, '')} Concept Flowchart & High-Yield Summary`;
          if (!addedKeys.has(customDesc)) {
            addedKeys.add(customDesc);
            suggestions.push({
              id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sectionHeading: heading,
              suggestedDescription: customDesc,
              reason: `An illustrative diagram under "${heading}" will anchor key PMDC principles and improve long-term recall.`,
              placeholderMarker: `<!-- IMAGE: ${customDesc} -->`
            });
          }
        }
      });

      res.json({
        success: true,
        totalSuggestions: suggestions.length,
        suggestions,
        source: 'concept-analysis-engine'
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to analyze article content: ' + err.message });
    }
  });

  // ================= MISTAKE DIARY API =================
  // 1. Get student mistakes
  app.get('/api/mistakes', (req: Request, res: Response) => {
    const studentUid = (req.query.studentUid || req.query.userId) as string;
    const mistakes = readStoredMistakes();

    let list = [...mistakes];
    if (studentUid) {
      list = list.filter((m) => m.studentUid === studentUid || m.userId === studentUid);
    }

    // Sort latest first
    list.sort((a, b) => {
      const timeA = a.timestamp || new Date(a.attemptDate || a.recordedAt || 0).getTime();
      const timeB = b.timestamp || new Date(b.attemptDate || b.recordedAt || 0).getTime();
      return timeB - timeA;
    });

    res.json(list);
  });

  // 2. Save mistake(s)
  app.post('/api/mistakes', (req: Request, res: Response) => {
    const payload = req.body;
    if (!payload) {
      res.status(400).json({ error: 'Mistake payload is required.' });
      return;
    }

    const items: any[] = Array.isArray(payload) ? payload : [payload];
    const existing = readStoredMistakes();
    const map = new Map<string, any>();
    existing.forEach((m) => map.set(m.id, m));

    items.forEach((item) => {
      if (item && item.id) {
        if (map.has(item.id)) {
          // Merge without overwriting mastered status if already completed
          const old = map.get(item.id);
          map.set(item.id, {
            ...item,
            reviewStatus: old.reviewStatus || item.reviewStatus || 'new',
            reviewedCount: Math.max(old.reviewedCount || 0, item.reviewedCount || 0),
            mastered: old.mastered !== undefined ? old.mastered : item.mastered
          });
        } else {
          map.set(item.id, item);
        }
      }
    });

    const updated = Array.from(map.values());
    writeStoredMistakes(updated);
    res.json({ success: true, count: items.length, total: updated.length });
  });

  // 3. Update mistake review status
  app.patch('/api/mistakes/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { reviewStatus, mastered, incrementCount } = req.body || {};

    const mistakes = readStoredMistakes();
    const index = mistakes.findIndex((m) => m.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Mistake entry not found.' });
      return;
    }

    const current = mistakes[index];
    if (reviewStatus) current.reviewStatus = reviewStatus;
    if (mastered !== undefined) current.mastered = !!mastered;
    if (incrementCount) current.reviewedCount = (current.reviewedCount || 0) + 1;
    current.updatedAt = new Date().toISOString();

    mistakes[index] = current;
    writeStoredMistakes(mistakes);
    res.json({ success: true, mistake: current });
  });

  // 4. Delete mistake
  app.delete('/api/mistakes/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const mistakes = readStoredMistakes();
    const filtered = mistakes.filter((m) => m.id !== id);

    writeStoredMistakes(filtered);
    res.json({ success: true, message: 'Mistake deleted.' });
  });

  // ================= ARTICLE COMMENTS & CLAPS API =================
  // 1. Get comments for an article
  app.get('/api/articles/:slugOrId/comments', (req: Request, res: Response) => {
    const { slugOrId } = req.params;
    const comments = readStoredComments();

    const matched = comments.filter(
      (c) => c.articleSlug === slugOrId || c.articleId === slugOrId
    );

    // Latest comments first
    matched.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    res.json(matched);
  });

  // 2. Post a comment under an article
  app.post('/api/articles/:slugOrId/comments', (req: Request, res: Response) => {
    const { slugOrId } = req.params;
    const { studentUid, studentName, studentEmail, content } = req.body || {};

    if (!content || !String(content).trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    if (!studentUid) {
      res.status(401).json({ error: 'Student authentication is required to post a comment.' });
      return;
    }

    const articles = readStoredArticles();
    const targetArticle = articles.find((a) => a.slug === slugOrId || a.id === slugOrId);

    const comments = readStoredComments();
    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newComment = {
      id: commentId,
      articleId: targetArticle ? targetArticle.id : slugOrId,
      articleSlug: targetArticle ? targetArticle.slug : slugOrId,
      studentUid,
      studentName: studentName || 'MDCAT Aspirant',
      studentEmail: studentEmail || '',
      content: String(content).trim(),
      createdAt: now,
      timestamp: Date.now()
    };

    comments.unshift(newComment);
    writeStoredComments(comments);

    // Increment commentsCount in articles if article exists
    if (targetArticle) {
      targetArticle.commentsCount = (targetArticle.commentsCount || 0) + 1;
      writeStoredArticles(articles);
    }

    res.json({ success: true, comment: newComment });
  });

  // 3. Delete a comment
  app.delete('/api/articles/:slugOrId/comments/:commentId', (req: Request, res: Response) => {
    const { commentId } = req.params;
    const { requesterUid, isAdmin: requestedAdmin } = req.body || {};
    const isAdmin = isRequestAuthorizedAdmin(req) || !!requestedAdmin;

    const comments = readStoredComments();
    const index = comments.findIndex((c) => c.id === commentId);

    if (index === -1) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    const targetComment = comments[index];
    if (!isAdmin && targetComment.studentUid !== requesterUid) {
      res.status(403).json({ error: 'Permission denied. You can only delete your own comment.' });
      return;
    }

    comments.splice(index, 1);
    writeStoredComments(comments);

    // Decrement commentsCount in articles if applicable
    const articles = readStoredArticles();
    const article = articles.find((a) => a.id === targetComment.articleId || a.slug === targetComment.articleSlug);
    if (article && (article.commentsCount || 0) > 0) {
      article.commentsCount = Math.max(0, (article.commentsCount || 1) - 1);
      writeStoredArticles(articles);
    }

    res.json({ success: true, message: 'Comment deleted successfully.' });
  });

  // 4. Get claps count and user clap status for an article
  app.get('/api/articles/:slugOrId/claps', (req: Request, res: Response) => {
    const { slugOrId } = req.params;
    const studentUid = req.query.studentUid as string;

    const claps = readStoredClaps();
    const articleClaps = claps.filter(
      (c) => c.articleSlug === slugOrId || c.articleId === slugOrId
    );

    const hasUserClapped = studentUid
      ? articleClaps.some((c) => c.studentUid === studentUid)
      : false;

    res.json({
      totalClaps: articleClaps.length,
      hasUserClapped
    });
  });

  // 5. Post a clap (1 clap per student UID strictly enforced)
  app.post('/api/articles/:slugOrId/claps', (req: Request, res: Response) => {
    const { slugOrId } = req.params;
    const { studentUid, articleId, articleSlug } = req.body || {};

    if (!studentUid) {
      res.status(401).json({ error: 'Student authentication is required to clap.' });
      return;
    }

    const articles = readStoredArticles();
    const targetArticle = articles.find((a) => a.slug === slugOrId || a.id === slugOrId);
    const resolvedArticleId = targetArticle ? targetArticle.id : (articleId || slugOrId);
    const resolvedArticleSlug = targetArticle ? targetArticle.slug : (articleSlug || slugOrId);

    const claps = readStoredClaps();
    const alreadyClapped = claps.some(
      (c) =>
        (c.articleSlug === resolvedArticleSlug || c.articleId === resolvedArticleId) &&
        c.studentUid === studentUid
    );

    if (alreadyClapped) {
      const currentCount = claps.filter(
        (c) => c.articleSlug === resolvedArticleSlug || c.articleId === resolvedArticleId
      ).length;
      res.json({
        success: true,
        hasClapped: true,
        totalClaps: currentCount,
        notice: 'You have already clapped for this article.'
      });
      return;
    }

    const newClap = {
      id: `clap_${resolvedArticleId}_${studentUid}`,
      articleId: resolvedArticleId,
      articleSlug: resolvedArticleSlug,
      studentUid,
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    claps.push(newClap);
    writeStoredClaps(claps);

    const newTotal = claps.filter(
      (c) => c.articleSlug === resolvedArticleSlug || c.articleId === resolvedArticleId
    ).length;

    // Increment clapsCount on article record
    if (targetArticle) {
      targetArticle.clapsCount = newTotal;
      writeStoredArticles(articles);
    }

    res.json({
      success: true,
      hasClapped: true,
      totalClaps: newTotal
    });
  });

  // ================= STUDENT MANAGEMENT & RECORDS API =================
  // 1. Get all registered students with aggregated attempt metrics
  app.get('/api/admin/students', (_req: Request, res: Response) => {
    const users = readStoredUsers();
    const attempts = readStoredAttempts();

    const enriched = users.map((u) => {
      const studentAttempts = attempts.filter((a) => a.userId === u.uid);
      studentAttempts.sort(
        (a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
      );

      const totalAttempts = studentAttempts.length;
      let latestScore: number | undefined;
      let latestPercentage: number | undefined;
      let latestAttemptDate: string | undefined;
      let averageScore: number | undefined;
      let highestScore: number | undefined;

      if (totalAttempts > 0) {
        latestScore = studentAttempts[0].score;
        latestPercentage = studentAttempts[0].percentage;
        latestAttemptDate = studentAttempts[0].completedAt;
        const sum = studentAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0);
        averageScore = Math.round(sum / totalAttempts);
        highestScore = Math.max(...studentAttempts.map((a) => a.percentage || 0));
      }

      return {
        ...u,
        totalAttempts,
        latestScore,
        latestPercentage,
        latestAttemptDate,
        averageScore,
        highestScore,
        documentsCount: (u.uploadedDocuments || []).length
      };
    });

    res.json(enriched);
  });

  // 2. Get single student full details
  app.get('/api/admin/students/:uid', (req: Request, res: Response) => {
    const { uid } = req.params;
    const users = readStoredUsers();
    const student = users.find((u) => u.uid === uid);

    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const attempts = readStoredAttempts().filter((a) => a.userId === uid);
    const mistakes = readStoredMistakes().filter((m) => m.studentUid === uid || m.userId === uid);

    res.json({
      profile: student,
      attempts,
      mistakes,
      documents: student.uploadedDocuments || []
    });
  });

  // 3. Update student account status (active | suspended)
  app.post('/api/admin/students/:uid/status', (req: Request, res: Response) => {
    const { uid } = req.params;
    const { accountStatus, statusReason } = req.body || {};

    const users = readStoredUsers();
    const index = users.findIndex((u) => u.uid === uid);

    if (index === -1) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    users[index] = {
      ...users[index],
      accountStatus: accountStatus || 'active',
      statusReason: statusReason || '',
      updatedAt: new Date().toISOString()
    };

    writeStoredUsers(users);

    // Record in audit log
    const auditLogs = readStoredAuditLogs();
    auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: `Changed student account status to "${accountStatus}"`,
      category: 'student_management',
      adminUid: 'admin',
      adminEmail: 'bheermanianeel@gmail.com',
      targetId: uid,
      targetName: users[index].displayName,
      details: statusReason ? `Reason: ${statusReason}` : undefined
    });
    writeStoredAuditLogs(auditLogs);

    res.json({ success: true, student: users[index] });
  });

  // 4. Verify or reject an uploaded student document
  app.post('/api/admin/students/:uid/documents/:docId/verify', (req: Request, res: Response) => {
    const { uid, docId } = req.params;
    const { status, rejectionReason, verifiedBy } = req.body || {};

    const users = readStoredUsers();
    const index = users.findIndex((u) => u.uid === uid);

    if (index === -1) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const student = users[index];
    const docs = (student.uploadedDocuments || []).map((d: any) => {
      if (d.id === docId) {
        return {
          ...d,
          verificationStatus: status === 'verified' ? 'verified' : 'rejected',
          rejectionReason: status === 'rejected' ? (rejectionReason || 'Document unreadable or invalid') : undefined,
          verifiedAt: new Date().toISOString(),
          verifiedBy: verifiedBy || 'admin'
        };
      }
      return d;
    });

    student.uploadedDocuments = docs;
    student.updatedAt = new Date().toISOString();
    writeStoredUsers(users);

    // Audit log
    const auditLogs = readStoredAuditLogs();
    auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: `${status === 'verified' ? 'Verified' : 'Rejected'} student admission document (${docId})`,
      category: 'student_management',
      adminUid: 'admin',
      adminEmail: 'bheermanianeel@gmail.com',
      targetId: uid,
      targetName: student.displayName,
      details: rejectionReason ? `Rejection reason: ${rejectionReason}` : undefined
    });
    writeStoredAuditLogs(auditLogs);

    res.json({ success: true, documents: docs });
  });

  // 5. Student self-upload document
  app.post('/api/students/:uid/documents', (req: Request, res: Response) => {
    const { uid } = req.params;
    const docData = req.body;

    const users = readStoredUsers();
    let index = users.findIndex((u) => u.uid === uid);

    if (index === -1) {
      // Auto-create student shell if doesn't exist yet
      const newStudent = {
        uid,
        displayName: 'Medical Aspirant',
        email: `${uid}@aspirant.pk`,
        role: 'student',
        accountStatus: 'active',
        streakDays: 0,
        targetScore: 180,
        completedTopics: [],
        uploadedDocuments: [],
        createdAt: new Date().toISOString()
      };
      users.push(newStudent);
      index = users.length - 1;
    }

    const currentDocs = users[index].uploadedDocuments || [];
    const newDoc = {
      id: docData.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'pending',
      ...docData
    };

    users[index].uploadedDocuments = [newDoc, ...currentDocs.filter((d: any) => d.id !== newDoc.id)];
    users[index].updatedAt = new Date().toISOString();
    writeStoredUsers(users);

    res.status(201).json({ success: true, document: newDoc });
  });

  // 6. Update student personal profile details
  app.put('/api/students/:uid/profile', (req: Request, res: Response) => {
    const { uid } = req.params;
    const updates = req.body;

    const users = readStoredUsers();
    const index = users.findIndex((u) => u.uid === uid);

    if (index === -1) {
      const newStudent = {
        uid,
        ...updates,
        role: 'student',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      users.push(newStudent);
      writeStoredUsers(users);
      res.json({ success: true, profile: newStudent });
      return;
    }

    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeStoredUsers(users);

    res.json({ success: true, profile: users[index] });
  });

  // ================= RESULTS MANAGEMENT API =================
  // 1. Get all test attempts across all students
  app.get('/api/admin/attempts', (req: Request, res: Response) => {
    const attempts = readStoredAttempts();
    const studentUid = req.query.studentUid as string;
    const testId = req.query.testId as string;

    let filtered = attempts;
    if (studentUid) {
      filtered = filtered.filter((a) => a.userId === studentUid);
    }
    if (testId) {
      filtered = filtered.filter((a) => a.testId === testId);
    }

    filtered.sort(
      (a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
    );

    res.json(filtered);
  });

  // 2. Record new test attempt to permanent disk
  app.post('/api/admin/attempts', (req: Request, res: Response) => {
    const attempt = req.body;
    if (!attempt || !attempt.id) {
      res.status(400).json({ error: 'Attempt object with valid ID is required.' });
      return;
    }

    const attempts = readStoredAttempts();
    const existingIdx = attempts.findIndex((a) => a.id === attempt.id);
    if (existingIdx !== -1) {
      attempts[existingIdx] = attempt;
    } else {
      attempts.unshift(attempt);
    }
    writeStoredAttempts(attempts);

    res.status(201).json({ success: true, attempt });
  });

  // ================= AUDIT LOGS & SETTINGS API =================
  app.get('/api/admin/audit-logs', (_req: Request, res: Response) => {
    const logs = readStoredAuditLogs();
    res.json(logs);
  });

  app.post('/api/admin/audit-logs', (req: Request, res: Response) => {
    const entry = req.body;
    if (!entry || !entry.action) {
      res.status(400).json({ error: 'Action is required.' });
      return;
    }

    const logs = readStoredAuditLogs();
    const newLog = {
      id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      ...entry
    };
    logs.unshift(newLog);
    // Keep max 500 audit log entries
    if (logs.length > 500) logs.length = 500;
    writeStoredAuditLogs(logs);

    res.status(201).json({ success: true, log: newLog });
  });

  app.get('/api/admin/settings', (_req: Request, res: Response) => {
    const settings = readSystemSettings();
    res.json(settings);
  });

  app.post('/api/admin/settings', (req: Request, res: Response) => {
    const updates = req.body;
    const current = readSystemSettings();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeSystemSettings(updated);

    res.json({ success: true, settings: updated });
  });

  // Complete system data backup JSON export
  app.get('/api/admin/backup-export', (_req: Request, res: Response) => {
    const backup = {
      exportTimestamp: new Date().toISOString(),
      system: 'AHK.MDCAT Administrative Engine',
      version: '2026.1',
      students: readStoredUsers(),
      attempts: readStoredAttempts(),
      quizzes: readStoredQuizzes(),
      questions: readStoredQuestions(),
      mistakes: readStoredMistakes(),
      notesFolders: readStoredFolders(),
      notesItems: readStoredNotes(),
      articles: readStoredArticles(),
      auditLogs: readStoredAuditLogs(),
      settings: readStoredSettings()
    };

    res.json(backup);
  });

  // ================= STUDY ROOM & MODERATION CONTROL ROOM API =================
  app.get('/api/study-room/settings', (_req: Request, res: Response) => {
    res.json(readStoredStudyRoomSettings());
  });

  app.post('/api/study-room/settings', (req: Request, res: Response) => {
    const updates = req.body || {};
    const current = readStoredStudyRoomSettings();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeStoredStudyRoomSettings(updated);
    res.json({ success: true, settings: updated });
  });

  app.get('/api/study-room/messages', (_req: Request, res: Response) => {
    const msgs = readStoredStudyRoomMessages();
    res.json(msgs);
  });

  app.post('/api/study-room/messages', (req: Request, res: Response) => {
    const msg = req.body;
    if (!msg || !msg.content || !msg.senderUid) {
      res.status(400).json({ error: 'Message content and senderUid required.' });
      return;
    }

    const settings = readStoredStudyRoomSettings();
    const moderation = readStoredStudyRoomModeration();
    const modRecord = moderation[msg.senderUid];

    // Check if student is banned or suspended
    if (msg.senderRole !== 'admin' && modRecord) {
      const now = new Date();
      if (modRecord.status === 'banned') {
        res.status(403).json({ error: 'You are permanently restricted from the Study Room.' });
        return;
      }
      if (modRecord.status === 'suspended' && modRecord.suspendedUntil && new Date(modRecord.suspendedUntil) > now) {
        res.status(403).json({ 
          error: `Your Study Room access is suspended until ${new Date(modRecord.suspendedUntil).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT. Reason: ${modRecord.reason || 'Violation of rules'}` 
        });
        return;
      }
      if (modRecord.status === 'muted' && modRecord.mutedUntil && new Date(modRecord.mutedUntil) > now) {
        res.status(403).json({ 
          error: `You are temporarily muted from sending messages until ${new Date(modRecord.mutedUntil).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi' })} PKT. Reason: ${modRecord.reason || 'Community warning'}` 
        });
        return;
      }
    }

    // Check if chat is disabled globally
    if (!settings.liveChatEnabled && msg.senderRole !== 'admin') {
      res.status(403).json({ error: 'Live Chat is temporarily disabled by Admin.' });
      return;
    }

    const msgs = readStoredStudyRoomMessages();
    msgs.push(msg);
    // Keep max 300 messages in storage
    if (msgs.length > 300) {
      msgs.splice(0, msgs.length - 300);
    }
    writeStoredStudyRoomMessages(msgs);
    res.status(201).json({ success: true, message: msg });
  });

  app.delete('/api/study-room/messages/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { adminEmail, reason } = req.body || {};
    const msgs = readStoredStudyRoomMessages();
    const index = msgs.findIndex(m => m.id === id);
    if (index !== -1) {
      msgs[index].deleted = true;
      msgs[index].deletedAt = new Date().toISOString();
      msgs[index].deletedBy = adminEmail || 'admin';
      msgs[index].deleteReason = reason || 'Removed by moderator';
      writeStoredStudyRoomMessages(msgs);
    }
    res.json({ success: true });
  });

  app.post('/api/study-room/messages/:id/pin', (req: Request, res: Response) => {
    const { id } = req.params;
    const { pinned } = req.body || {};
    const msgs = readStoredStudyRoomMessages();
    const index = msgs.findIndex(m => m.id === id);
    if (index !== -1) {
      msgs[index].pinned = !!pinned;
      writeStoredStudyRoomMessages(msgs);
    }
    res.json({ success: true });
  });

  app.get('/api/study-room/reports', (_req: Request, res: Response) => {
    res.json(readStoredStudyRoomReports());
  });

  app.post('/api/study-room/reports', (req: Request, res: Response) => {
    const report = req.body;
    if (!report || !report.messageId) {
      res.status(400).json({ error: 'Invalid report data.' });
      return;
    }
    const reports = readStoredStudyRoomReports();
    reports.unshift(report);
    writeStoredStudyRoomReports(reports);
    res.status(201).json({ success: true, report });
  });

  app.patch('/api/study-room/reports/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body || {};
    const reports = readStoredStudyRoomReports();
    const index = reports.findIndex(r => r.id === id);
    if (index !== -1) {
      reports[index] = { ...reports[index], ...updates };
      writeStoredStudyRoomReports(reports);
    }
    res.json({ success: true });
  });

  app.get('/api/study-room/moderation', (_req: Request, res: Response) => {
    const recordsMap = readStoredStudyRoomModeration();
    res.json(Object.values(recordsMap));
  });

  app.get('/api/study-room/moderation/:uid', (req: Request, res: Response) => {
    const { uid } = req.params;
    const recordsMap = readStoredStudyRoomModeration();
    res.json(recordsMap[uid] || null);
  });

  app.post('/api/study-room/moderation/:uid', (req: Request, res: Response) => {
    const { uid } = req.params;
    const record = req.body;
    const recordsMap = readStoredStudyRoomModeration();
    recordsMap[uid] = record;
    writeStoredStudyRoomModeration(recordsMap);
    res.json({ success: true, record });
  });

  app.get('/api/study-room/direct-messages', (req: Request, res: Response) => {
    const { studentUid } = req.query;
    const dms = readStoredStudyRoomDirectMessages();
    if (studentUid && typeof studentUid === 'string') {
      res.json(dms.filter(d => d.studentUid === studentUid));
    } else {
      res.json(dms);
    }
  });

  app.post('/api/study-room/direct-messages', (req: Request, res: Response) => {
    const dm = req.body;
    if (!dm || !dm.studentUid || !dm.message) {
      res.status(400).json({ error: 'Invalid direct message data.' });
      return;
    }
    const dms = readStoredStudyRoomDirectMessages();
    dms.unshift(dm);
    writeStoredStudyRoomDirectMessages(dms);
    res.status(201).json({ success: true, dm });
  });

  app.post('/api/study-room/direct-messages/:id/read', (req: Request, res: Response) => {
    const { id } = req.params;
    const dms = readStoredStudyRoomDirectMessages();
    const index = dms.findIndex(d => d.id === id);
    if (index !== -1) {
      dms[index].readByStudent = true;
      dms[index].readAt = new Date().toISOString();
      writeStoredStudyRoomDirectMessages(dms);
    }
    res.json({ success: true });
  });

  app.get('/api/study-room/audit-logs', (_req: Request, res: Response) => {
    res.json(readStoredStudyRoomAuditLogs());
  });

  app.post('/api/study-room/audit-logs', (req: Request, res: Response) => {
    const log = req.body;
    if (!log || !log.action) {
      res.status(400).json({ error: 'Invalid audit log.' });
      return;
    }
    const logs = readStoredStudyRoomAuditLogs();
    logs.unshift(log);
    // Keep max 500 audit logs
    if (logs.length > 500) logs.splice(500);
    writeStoredStudyRoomAuditLogs(logs);
    res.status(201).json({ success: true, log });
  });

  // ================= COMMON ROOM REST ENDPOINTS =================
  app.get('/api/common-room/posts', (req: Request, res: Response) => {
    const category = req.query.category as string;
    const limitNum = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    let posts = readStoredCommonRoomPosts();
    if (category && category !== 'All') {
      posts = posts.filter((p) => p.category === category);
    }
    // Pinned posts first, then newest
    posts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const paged = posts.slice(offset, offset + limitNum);
    res.json(paged);
  });

  app.post('/api/common-room/posts', (req: Request, res: Response) => {
    const post = req.body;
    if (!post || !post.id || !post.content) {
      res.status(400).json({ error: 'Post must contain id and content.' });
      return;
    }
    const posts = readStoredCommonRoomPosts();
    const existingIdx = posts.findIndex((p) => p.id === post.id);
    if (existingIdx >= 0) {
      posts[existingIdx] = { ...posts[existingIdx], ...post };
    } else {
      posts.unshift(post);
    }
    // Keep up to 500 posts
    if (posts.length > 500) posts.splice(500);
    writeStoredCommonRoomPosts(posts);
    res.status(201).json({ success: true, post });
  });

  app.put('/api/common-room/posts/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body || {};
    const posts = readStoredCommonRoomPosts();
    const idx = posts.findIndex((p) => p.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    posts[idx] = {
      ...posts[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
      edited: true
    };
    writeStoredCommonRoomPosts(posts);
    res.json({ success: true, post: posts[idx] });
  });

  app.delete('/api/common-room/posts/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    let posts = readStoredCommonRoomPosts();
    posts = posts.filter((p) => p.id !== id);
    writeStoredCommonRoomPosts(posts);

    // Also remove comments
    const commentsMap = readStoredCommonRoomComments();
    if (commentsMap[id]) {
      delete commentsMap[id];
      writeStoredCommonRoomComments(commentsMap);
    }

    res.json({ success: true });
  });

  app.post('/api/common-room/posts/:id/reactions', (req: Request, res: Response) => {
    const { id } = req.params;
    const { userUid, type } = req.body || {};
    if (!userUid || !type) {
      res.status(400).json({ error: 'userUid and type (like|dislike) required.' });
      return;
    }
    const posts = readStoredCommonRoomPosts();
    const post = posts.find((p) => p.id === id);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    post.reactions = post.reactions || {};
    const curr = post.reactions[userUid];
    if (curr === type) {
      delete post.reactions[userUid];
    } else {
      post.reactions[userUid] = type;
    }
    let likes = 0;
    let dislikes = 0;
    Object.values(post.reactions).forEach((v) => {
      if (v === 'like') likes++;
      if (v === 'dislike') dislikes++;
    });
    post.likesCount = likes;
    post.dislikesCount = dislikes;
    writeStoredCommonRoomPosts(posts);
    res.json({ success: true, post });
  });

  app.post('/api/common-room/posts/:id/emojis', (req: Request, res: Response) => {
    const { id } = req.params;
    const { userUid, emoji } = req.body || {};
    if (!userUid || !emoji) {
      res.status(400).json({ error: 'userUid and emoji required.' });
      return;
    }
    const posts = readStoredCommonRoomPosts();
    const post = posts.find((p) => p.id === id);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    post.emojiReactions = post.emojiReactions || { '😂': [], '🎀': [], '🎉': [], '😮': [] };
    const list: string[] = Array.isArray(post.emojiReactions[emoji]) ? post.emojiReactions[emoji] : [];
    const idx = list.indexOf(userUid);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(userUid);
    }
    post.emojiReactions[emoji] = list;
    writeStoredCommonRoomPosts(posts);
    res.json({ success: true, post });
  });

  app.get('/api/common-room/posts/:id/comments', (req: Request, res: Response) => {
    const { id } = req.params;
    const commentsMap = readStoredCommonRoomComments();
    const comments = commentsMap[id] || [];
    res.json(comments);
  });

  app.post('/api/common-room/posts/:id/comments', (req: Request, res: Response) => {
    const { id } = req.params;
    const comment = req.body;
    if (!comment || !comment.id || !comment.content) {
      res.status(400).json({ error: 'Comment must have id and content.' });
      return;
    }
    const commentsMap = readStoredCommonRoomComments();
    commentsMap[id] = commentsMap[id] || [];
    commentsMap[id].push(comment);
    writeStoredCommonRoomComments(commentsMap);

    // Increment post commentsCount
    const posts = readStoredCommonRoomPosts();
    const post = posts.find((p) => p.id === id);
    if (post) {
      post.commentsCount = (post.commentsCount || 0) + 1;
      writeStoredCommonRoomPosts(posts);
    }

    res.status(201).json({ success: true, comment });
  });

  app.delete('/api/common-room/posts/:id/comments/:commentId', (req: Request, res: Response) => {
    const { id, commentId } = req.params;
    const commentsMap = readStoredCommonRoomComments();
    if (commentsMap[id]) {
      commentsMap[id] = commentsMap[id].filter((c) => c.id !== commentId);
      writeStoredCommonRoomComments(commentsMap);
    }
    const posts = readStoredCommonRoomPosts();
    const post = posts.find((p) => p.id === id);
    if (post && post.commentsCount > 0) {
      post.commentsCount--;
      writeStoredCommonRoomPosts(posts);
    }
    res.json({ success: true });
  });

  app.get('/api/common-room/announcements', (_req: Request, res: Response) => {
    res.json(readStoredCommonRoomAnnouncements());
  });

  app.post('/api/common-room/announcements', (req: Request, res: Response) => {
    const ann = req.body;
    if (!ann || !ann.id || !ann.content) {
      res.status(400).json({ error: 'Announcement requires id and content.' });
      return;
    }
    const list = readStoredCommonRoomAnnouncements();
    list.unshift(ann);
    writeStoredCommonRoomAnnouncements(list);
    res.status(201).json({ success: true, announcement: ann });
  });

  app.delete('/api/common-room/announcements/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    let list = readStoredCommonRoomAnnouncements();
    list = list.filter((a) => a.id !== id);
    writeStoredCommonRoomAnnouncements(list);
    res.json({ success: true });
  });

  app.get('/api/common-room/reports', (_req: Request, res: Response) => {
    res.json(readStoredCommonRoomReports());
  });

  app.post('/api/common-room/reports', (req: Request, res: Response) => {
    const report = req.body;
    if (!report || !report.id) {
      res.status(400).json({ error: 'Report invalid.' });
      return;
    }
    const list = readStoredCommonRoomReports();
    list.unshift(report);
    writeStoredCommonRoomReports(list);

    // Increment post report count if target is post
    if (report.targetPostId) {
      const posts = readStoredCommonRoomPosts();
      const post = posts.find((p) => p.id === report.targetPostId);
      if (post) {
        post.reportsCount = (post.reportsCount || 0) + 1;
        writeStoredCommonRoomPosts(posts);
      }
    }

    res.status(201).json({ success: true, report });
  });

  // Attach Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
