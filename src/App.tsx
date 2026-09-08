import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useAuth } from './hooks/useAuth';
import { AuthPage } from './pages/auth/AuthPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AllEngagementsPage } from './pages/engagement/AllEngagementsPage';
import { NewEngagementPage } from './pages/engagement/NewEngagementPage';
import { ScopingPage } from './pages/engagement/ScopingPage';
import { IssueTreePage } from './pages/engagement/IssueTreePage';
import { ResearchPage } from './pages/engagement/ResearchPage';
import { AnalysisPage } from './pages/engagement/AnalysisPage';
import { SynthesisPage } from './pages/engagement/SynthesisPage';
import { QualityCheckPage } from './pages/engagement/QualityCheckPage';
import { DeliverablePage } from './pages/engagement/DeliverablePage';
import { PresentationPage } from './pages/engagement/PresentationPage';
import { PresentationViewerPage } from './pages/engagement/PresentationViewerPage';
import { EngagementChatPage } from './pages/engagement/EngagementChatPage';
import { ReviewPage } from './pages/engagement/ReviewPage';
import { ReviewerQueuePage } from './pages/reviewer/ReviewerQueuePage';
import { ConnectorsPage } from './pages/platform/ConnectorsPage';
import { ConsolidatedDataPage } from './pages/platform/ConsolidatedDataPage';
import { AskAIPage } from './pages/platform/AskAIPage';
import { AgentProfilePage } from './pages/platform/AgentProfilePage';
import { LandingPage } from './pages/public/LandingPage';
import { PricingPage } from './pages/public/PricingPage';
import { AboutPage } from './pages/public/AboutPage';
import { ContactPage } from './pages/public/ContactPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { useTheme } from './hooks/useTheme';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner spinner-lg spinner-gold" style={{ margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.125rem', color: 'var(--off-white)' }}>
          Stratum Advisory
        </div>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  useTheme(); // Initialize global theme logic

  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/auth" element={<AuthPage />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/engagements" element={
            <ProtectedRoute><AllEngagementsPage /></ProtectedRoute>
          } />
          <Route path="/engagement/new" element={
            <ProtectedRoute><NewEngagementPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id" element={
            <ProtectedRoute><Navigate to="scoping" replace /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/scoping" element={
            <ProtectedRoute><ScopingPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/issue-tree" element={
            <ProtectedRoute><IssueTreePage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/research" element={
            <ProtectedRoute><ResearchPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/analysis" element={
            <ProtectedRoute><AnalysisPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/synthesis" element={
            <ProtectedRoute><SynthesisPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/quality-check" element={
            <ProtectedRoute><QualityCheckPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/deliverable" element={
            <ProtectedRoute><DeliverablePage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/presentation" element={
            <ProtectedRoute><PresentationViewerPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/present" element={
            <ProtectedRoute><PresentationPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/chat" element={
            <ProtectedRoute><EngagementChatPage /></ProtectedRoute>
          } />
          <Route path="/engagement/:id/review" element={
            <ProtectedRoute><ReviewPage /></ProtectedRoute>
          } />
          <Route path="/reviewer" element={
            <ProtectedRoute><ReviewerQueuePage /></ProtectedRoute>
          } />
          <Route path="/platform/connectors" element={
            <ProtectedRoute><ConnectorsPage /></ProtectedRoute>
          } />
          <Route path="/platform/data" element={
            <ProtectedRoute><ConsolidatedDataPage /></ProtectedRoute>
          } />
          <Route path="/platform/ask-ai" element={
            <ProtectedRoute><AskAIPage /></ProtectedRoute>
          } />
          <Route path="/agent/:id" element={
            <ProtectedRoute><AgentProfilePage /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}
