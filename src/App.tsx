/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, isAuthorizedAdminEmail } from './context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { QuizProvider, useQuiz } from './context/QuizContext';
import { MobileShell } from './components/layout/MobileShell';
import { LandingPage } from './components/landing/LandingPage';
import { StudentHome } from './components/home/StudentHome';
import { SyllabusExplorer } from './components/syllabus/SyllabusExplorer';
import { ChapterLearningScreen } from './components/syllabus/ChapterLearningScreen';
import { PracticeMCQs } from './components/practice/PracticeMCQs';
import { PracticeHub } from './components/practice/PracticeHub';
import { MockTestInterface } from './components/test/MockTestInterface';
import { ActiveTestPlayer } from './components/test/ActiveTestPlayer';
import { ResultsAnalytics } from './components/results/ResultsAnalytics';
import { MistakeDiary } from './components/diary/MistakeDiary';
import { FlashcardsView } from './components/flashcards/FlashcardsView';
import { StudyPlanner } from './components/planner/StudyPlanner';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { McqTestBuilder } from './components/admin/McqTestBuilder';
import { SyllabusVerificationPanel } from './components/admin/SyllabusVerificationPanel';
import { UserProfileView } from './components/profile/UserProfileView';
import { StudentNotesLibrary } from './components/notes/StudentNotesLibrary';
import { NotesProvider } from './context/NotesContext';
import { ArticleProvider } from './context/ArticleContext';
import { StudentArticlesList } from './components/articles/StudentArticlesList';
import { ArticleReadingView } from './components/articles/ArticleReadingView';
import { StudentLeaderboardView } from './components/leaderboard/StudentLeaderboardView';
import { StudentStudyRoom } from './components/studyroom/StudentStudyRoom';
import { StudentMoreHub } from './components/more/StudentMoreHub';
import { AuthModal } from './components/auth/AuthModal';
import { StethoscopeLogo } from './components/common/MedicalIcons';
import { ActiveScreen, Subject, SyllabusChapter, TestAttempt, MistakeEntry, QuizTest } from './types';
import { SEED_CHAPTERS } from './data/seedData';
import { PmdcTopic } from './data/pmdcSyllabus2026';

const MainApp: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('landing');
  const [selectedChapter, setSelectedChapter] = useState<SyllabusChapter>(SEED_CHAPTERS[0]);
  const [practiceSubject, setPracticeSubject] = useState<Subject | undefined>(undefined);
  const [practiceChapterName, setPracticeChapterName] = useState<string | undefined>(undefined);
  const [latestAttempt, setLatestAttempt] = useState<TestAttempt | undefined>(undefined);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizTest | null>(null);
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');

  const { currentUser, userProfile, isAdmin, loading } = useAuth();
  const { isAdminVerified } = useAdminAuth();
  const { fetchQuizById, quizzes } = useQuiz();

  const isMasterAdmin = Boolean(
    currentUser &&
    isAuthorizedAdminEmail(currentUser.email) &&
    (isAdmin || userProfile?.role === 'admin' || isAdminVerified)
  );

  // Listen to shareable URL: /practice/test/:id, /?test=:id, or /?article=:slug
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let directId = params.get('test');

    // Support direct path /practice/test/{testId}
    if (!directId && typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/practice\/test\/([^/]+)/);
      if (pathMatch && pathMatch[1]) {
        directId = decodeURIComponent(pathMatch[1]);
      }
    }
    // Support hash deep links #/practice/test/{testId} or #/test/{testId}
    if (!directId && window.location.hash.startsWith('#/practice/test/')) {
      directId = window.location.hash.replace('#/practice/test/', '');
    } else if (!directId && window.location.hash.startsWith('#/test/')) {
      directId = window.location.hash.replace('#/test/', '');
    }

    if (directId) {
      fetchQuizById(directId).then((found) => {
        if (found) {
          setSelectedQuiz(found);
          setActiveScreen('test-player');
        }
      });
    }

    const articleParam = params.get('article');
    let directArticleSlug = articleParam;
    if (!directArticleSlug && window.location.hash.startsWith('#/article/')) {
      directArticleSlug = window.location.hash.replace('#/article/', '');
    }
    if (directArticleSlug) {
      setSelectedArticleSlug(directArticleSlug);
      setActiveScreen('article-detail');
    }

    // Direct /admin or /study-room navigation
    const screenParam = params.get('screen');
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    if (screenParam === 'admin' || path === '/admin' || hash === '#/admin') {
      if (isMasterAdmin) {
        setActiveScreen('admin');
      }
    } else if (screenParam === 'study-room' || path === '/study-room' || hash === '#/study-room') {
      setActiveScreen('study-room');
    }
  }, [fetchQuizById, isMasterAdmin]);

  const handleNavigate = (screen: ActiveScreen, params?: { subject?: Subject; chapterId?: string }) => {
    if (params?.subject) {
      setPracticeSubject(params.subject);
    }
    if (params?.chapterId) {
      const found = SEED_CHAPTERS.find((c) => c.id === params.chapterId);
      if (found) setSelectedChapter(found);
    }
    setActiveScreen(screen);
  };

  const handleSelectChapter = (chapter: SyllabusChapter) => {
    setSelectedChapter(chapter);
    setActiveScreen('chapter');
  };

  const handlePracticeChapter = (chapter: SyllabusChapter) => {
    setSelectedChapter(chapter);
    setPracticeSubject(chapter.subject);
    setPracticeChapterName(chapter.name);
    setActiveScreen('drill');
  };

  const handleStartLearningTopic = (topic: PmdcTopic) => {
    const matchingChapter = SEED_CHAPTERS.find(
      (c) => c.subject === topic.subject && (c.name.includes(topic.unitName) || topic.unitName.includes(c.name))
    );

    if (matchingChapter) {
      setSelectedChapter(matchingChapter);
    } else {
      setSelectedChapter({
        id: `pmdc-${topic.id}`,
        subject: topic.subject,
        chapterNumber: topic.unitNumber,
        name: topic.unitName,
        classLevel: 'Class 11',
        completionPercentage: 50,
        learningObjectives: topic.learningOutcomes,
        notes: topic.notes || `PMDC 2026 Curriculum unit notes for ${topic.topicName}.`,
        topics: [{ id: topic.id, name: topic.topicName, completed: false }]
      });
    }
    setActiveScreen('chapter');
  };

  const handlePracticeTopic = (topic: PmdcTopic) => {
    setPracticeSubject(topic.subject);
    setPracticeChapterName(topic.unitName);
    setActiveScreen('drill');
  };

  const handleOpenTest = (quiz: QuizTest, isPreview = false) => {
    setSelectedQuiz(quiz);
    setIsPreviewMode(isPreview);
    setActiveScreen('test-player');
    try {
      window.history.pushState(null, '', `/practice/test/${encodeURIComponent(quiz.id)}`);
    } catch (e) {
      // safe in frame
    }
  };

  const handleFinishTestPlayer = (attempt: TestAttempt) => {
    setLatestAttempt(attempt);
    // Student remains on ActiveTestPlayer's full Post-Test Summary
  };

  const handleBackFromTest = () => {
    setSelectedQuiz(null);
    setIsPreviewMode(false);
    setActiveScreen('home');
    try {
      window.history.pushState(null, '', window.location.pathname.replace(/\/practice\/test\/[^/]+/, '/') || '/');
    } catch (e) {
      // safe
    }
  };

  const handlePracticeMistakeQuestion = (mistake: MistakeEntry) => {
    setPracticeSubject(mistake.subject);
    setActiveScreen('practice');
  };

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthInitialMode(mode);
    setIsAuthOpen(true);
  };

  // Automatically open Student Dashboard after login/registration, or default to Landing
  useEffect(() => {
    if (!loading) {
      if (currentUser && activeScreen === 'landing') {
        setActiveScreen('home');
      } else if (!currentUser && activeScreen !== 'landing' && activeScreen !== 'test-player' && activeScreen !== 'article-detail') {
        setActiveScreen('landing');
      }
    }
  }, [currentUser, loading, activeScreen]);

  // Exclusive Admin route protection: Prevent unauthorized access to Admin Dashboard
  useEffect(() => {
    if (!loading) {
      const adminScreens: ActiveScreen[] = ['admin', 'builder', 'syllabus-verification'];
      if (adminScreens.includes(activeScreen) && !isMasterAdmin) {
        setActiveScreen(currentUser ? 'home' : 'landing');
      }
    }
  }, [activeScreen, isMasterAdmin, loading, currentUser]);

  // Loading Splash Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF5EF] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full bg-white shadow-md p-2 flex items-center justify-center ring-2 ring-[#702D32]/20 animate-pulse">
          <StethoscopeLogo size={44} className="w-11 h-11" />
        </div>
        <div className="mt-4 text-center">
          <span className="font-extrabold text-base tracking-tight text-[#492327]">
            AHK<span className="text-[#702D32]">.MDCAT</span>
          </span>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Loading preparation portal...
          </p>
        </div>
      </div>
    );
  }

  // 0. Public Landing Page for visitors
  if (activeScreen === 'landing') {
    return (
      <>
        <LandingPage
          onOpenAuth={openAuthModal}
          onEnterDashboard={() => setActiveScreen('home')}
          isLoggedIn={Boolean(currentUser)}
        />
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          initialMode={authInitialMode}
        />
      </>
    );
  }

  return (
    <MobileShell
      activeScreen={activeScreen}
      setActiveScreen={setActiveScreen}
      onOpenAuth={() => openAuthModal('signin')}
    >
      {/* 1. Student Home Dashboard */}
      {activeScreen === 'home' && (
        <StudentHome
          onNavigate={handleNavigate}
          onOpenMockTest={() => {
            setActiveScreen('practice');
          }}
          onOpenTest={(quiz) => handleOpenTest(quiz)}
          onOpenTopic={handleStartLearningTopic}
        />
      )}

      {/* 2. PMDC Syllabus Explorer */}
      {activeScreen === 'syllabus' && (
        <SyllabusExplorer
          initialSubject={practiceSubject}
          onStartLearningTopic={handleStartLearningTopic}
          onPracticeTopic={handlePracticeTopic}
        />
      )}

      {/* 3. Chapter Learning Screen */}
      {activeScreen === 'chapter' && (
        <ChapterLearningScreen
          chapter={selectedChapter}
          onBack={() => setActiveScreen('syllabus')}
          onPracticeChapter={handlePracticeChapter}
        />
      )}

      {/* 4. Practice Hub (5 Dedicated Folders + Search) */}
      {activeScreen === 'practice' && (
        <PracticeHub
          onStartTest={(quiz) => handleOpenTest(quiz)}
          onOpenMistakes={() => setActiveScreen('mistakes')}
          onOpenSyllabus={() => setActiveScreen('syllabus')}
        />
      )}

      {/* 4b. Topic & Chapter Practice Drill */}
      {activeScreen === 'drill' && (
        <PracticeMCQs
          initialSubject={practiceSubject}
          initialChapter={practiceChapterName}
          onBack={() => setActiveScreen('practice')}
          onViewMistakes={() => setActiveScreen('mistakes')}
        />
      )}

      {/* 5. Legacy Mock Test Interface */}
      {activeScreen === 'mock-test' && (
        <MockTestInterface
          onBack={() => setActiveScreen('home')}
          onFinishTest={(attempt) => {
            setLatestAttempt(attempt);
            setActiveScreen('results');
          }}
        />
      )}

      {/* 5b. High-Yield Student Active Test Player (with direct URL support) */}
      {activeScreen === 'test-player' && selectedQuiz && (
        <ActiveTestPlayer
          quiz={selectedQuiz}
          isPreview={isPreviewMode}
          onBack={handleBackFromTest}
          onOpenAuth={() => openAuthModal('signin')}
          onFinish={handleFinishTestPlayer}
          onViewMistakes={() => setActiveScreen('mistakes')}
        />
      )}

      {activeScreen === 'test-player' && !selectedQuiz && (
        <div className="p-6 text-center space-y-4 bg-white rounded-3xl border border-stone-200 shadow-2xs my-4">
          <p className="text-xs text-slate-500">No test selected.</p>
          <button
            onClick={() => setActiveScreen('home')}
            className="px-4 py-2 bg-[#702D32] text-white text-xs font-bold rounded-xl"
          >
            Go Home
          </button>
        </div>
      )}

      {/* 6. Results & Performance Analytics */}
      {activeScreen === 'results' && (
        <ResultsAnalytics
          latestAttempt={latestAttempt}
          onRetake={() => {
            if (selectedQuiz) {
              handleOpenTest(selectedQuiz);
            } else {
              const pub = quizzes.find((q) => q.status === 'published' || q.isPublished === true);
              if (pub) {
                handleOpenTest(pub);
              } else {
                setActiveScreen('home');
              }
            }
          }}
          onOpenMistakes={() => setActiveScreen('mistakes')}
          onOpenSyllabus={() => setActiveScreen('syllabus')}
        />
      )}

      {/* 7. Flashcards */}
      {activeScreen === 'flashcards' && (
        <FlashcardsView onBack={() => setActiveScreen('home')} />
      )}

      {/* 8. Mistake Diary */}
      {activeScreen === 'mistakes' && (
        <MistakeDiary
          onPracticeQuestion={handlePracticeMistakeQuestion}
          onBack={() => setActiveScreen('home')}
        />
      )}

      {/* 9. Study Planner */}
      {activeScreen === 'planner' && (
        <StudyPlanner onBack={() => setActiveScreen('home')} />
      )}

      {/* 10. Admin Dashboard with 8 Sections */}
      {activeScreen === 'admin' && (
        <AdminDashboard
          onBackToStudent={() => setActiveScreen('home')}
          onPreviewTest={(quiz) => handleOpenTest(quiz, true)}
        />
      )}

      {/* 11. MCQ Upload & Test Builder (direct route) */}
      {activeScreen === 'builder' && (
        <McqTestBuilder onBack={() => setActiveScreen('admin')} />
      )}

      {/* 12. PMDC Syllabus Verification Panel (direct route) */}
      {activeScreen === 'syllabus-verification' && (
        <SyllabusVerificationPanel onBack={() => setActiveScreen('admin')} />
      )}

      {/* 13. User Profile View */}
      {activeScreen === 'profile' && (
        <UserProfileView
          onNavigate={setActiveScreen}
          onOpenAuth={() => openAuthModal('signin')}
        />
      )}

      {/* 15. Student Notes Library */}
      {activeScreen === 'notes' && (
        <StudentNotesLibrary
          onBackToHome={() => setActiveScreen('home')}
          onOpenSyllabus={() => setActiveScreen('syllabus')}
        />
      )}

      {/* 16. Student Articles & Guides List */}
      {activeScreen === 'articles' && (
        <StudentArticlesList
          onSelectArticle={(slug) => {
            setSelectedArticleSlug(slug);
            setActiveScreen('article-detail');
            try {
              window.history.pushState(null, '', `/?article=${encodeURIComponent(slug)}`);
            } catch (e) {}
          }}
        />
      )}

      {/* 17. Student Full Article Reading View */}
      {activeScreen === 'article-detail' && selectedArticleSlug && (
        <ArticleReadingView
          slugOrId={selectedArticleSlug}
          onBack={() => {
            setActiveScreen('articles');
            try {
              window.history.pushState(null, '', window.location.pathname);
            } catch (e) {}
          }}
          onSelectArticle={(slug) => {
            setSelectedArticleSlug(slug);
            try {
              window.history.pushState(null, '', `/?article=${encodeURIComponent(slug)}`);
            } catch (e) {}
          }}
        />
      )}

      {/* 18. Smart Student Leaderboard View */}
      {activeScreen === 'leaderboard' && (
        <StudentLeaderboardView
          onBack={() => setActiveScreen('home')}
          onNavigate={(screen) => setActiveScreen(screen)}
        />
      )}

      {/* 19. Peer Study Room & Moderated Discussion */}
      {activeScreen === 'study-room' && (
        <StudentStudyRoom
          onNavigateToScreen={(screen) => setActiveScreen(screen)}
        />
      )}

      {/* 20. Student More Hub */}
      {activeScreen === 'more' && (
        <StudentMoreHub
          onNavigate={handleNavigate}
          onOpenTest={(quiz) => handleOpenTest(quiz)}
          onOpenMockTest={() => setActiveScreen('practice')}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authInitialMode}
      />
    </MobileShell>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <QuizProvider>
          <NotesProvider>
            <ArticleProvider>
              <MainApp />
            </ArticleProvider>
          </NotesProvider>
        </QuizProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
