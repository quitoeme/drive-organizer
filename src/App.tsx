import React, { useState, useEffect } from 'react';
import { 
  FolderSearch, 
  Settings, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  FolderOpen, 
  Image as ImageIcon, 
  Video as VideoIcon,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { listFiles, renameAndMoveFile, createFolderIfNotExist } from './lib/google-drive';
import { getOrganizationPlan } from './lib/gemini';

// --- Components ---

const Navbar = ({ onLogout, user }: { onLogout: () => void, user: any }) => (
  <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
    <div className="flex items-center gap-2">
      <div className="bg-blue-600 p-2 rounded-xl">
        <Sparkles className="text-white w-6 h-6" />
      </div>
      <span className="text-xl font-bold tracking-tight">Drive Organizer</span>
    </div>
    <div className="flex items-center gap-4">
      {user && (
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
          <img src={user.picture} className="w-8 h-8 rounded-full" alt="avatar" />
          <span className="text-sm font-medium">{user.name}</span>
          <button onClick={onLogout} className="text-gray-400 hover:text-white">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </nav>
);

const FileItem = ({ file, plan, status }: { file: any, plan: any, status: string }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="file-card glass border border-white/5 p-4 flex items-center justify-between gap-4"
  >
    <div className="flex items-center gap-4">
      <div className="bg-white/5 p-3 rounded-lg">
        {file.mimeType.includes('image') ? <ImageIcon className="text-blue-400 w-5 h-5" /> : <VideoIcon className="text-purple-400 w-5 h-5" />}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-400 truncate max-w-[200px]">{file.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <p className="text-sm font-semibold text-blue-400">{plan?.suggestedName || 'Analyzing...'}</p>
        </div>
      </div>
    </div>
    <div className="text-right">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Target Folder</span>
      <span className="text-xs bg-white/5 px-2 py-1 rounded border border-white/10 text-gray-300">
        {plan?.targetFolder || '...'}
      </span>
    </div>
    {status === 'done' && <CheckCircle2 className="text-green-500 w-5 h-5" />}
  </motion.div>
);

// --- Main App ---

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('drive_token'));
  const [user, setUser] = useState<any>(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [clientId, setClientId] = useState(localStorage.getItem('google_client_id') || '');
  const [folderId, setFolderId] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [plans, setPlans] = useState<Record<string, any>>({});
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'landing' | 'setup' | 'selection' | 'preview' | 'done'>('landing');

  useEffect(() => {
    if (accessToken) {
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(() => setAccessToken(null));
    }
  }, [accessToken]);

  useEffect(() => {
    if (import.meta.env.VITE_GEMINI_API_KEY && clientId && step === 'setup') {
      setStep('selection');
    }
  }, [clientId, step]);

  const handleGoogleLogin = () => {
    if (!clientId) return alert("Please enter Google Client ID");
    // @ts-ignore
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly contentinfo',
      callback: (response: any) => {
        if (response.access_token) {
          setAccessToken(response.access_token);
          localStorage.setItem('drive_token', response.access_token);
        }
      },
    });
    client.requestAccessToken();
  };

  const handleScan = async () => {
    if (!folderId) return alert("Please enter a Folder ID");
    setProcessing(true);
    try {
      const driveFiles = await listFiles(folderId, accessToken!);
      setFiles(driveFiles);
      setStep('preview');
      for (const file of driveFiles) {
        const plan = await getOrganizationPlan(file, apiKey);
        setPlans(prev => ({ ...prev, [file.id]: plan }));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleOrganize = async () => {
    setProcessing(true);
    try {
      for (const file of files) {
        const plan = plans[file.id];
        if (!plan) continue;
        const targetFolderId = await createFolderIfNotExist(plan.targetFolder, folderId, accessToken!);
        await renameAndMoveFile(file.id, plan.suggestedName, targetFolderId, accessToken!, folderId);
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done' } : f));
      }
      setStep('done');
    } catch (e: any) {
      alert("Organizing Error: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('google_client_id', clientId);
    setStep('selection');
  };

  return (
    <div className="min-h-screen text-white flex flex-col font-sans">
      <Navbar user={user} onLogout={() => { setAccessToken(null); setStep('landing'); }} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-12">
        <AnimatePresence mode="wait">
          
          {step === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center mt-12"
            >
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full mb-8">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Powered by Gemini 3.5 Flash</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight">
                Organize your Drive <br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent italic">with Intelligence</span>
              </h1>
              
              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                Connect your Google Drive and let our agent rename, categorize, and nomenclature your media files automatically using state-of-the-art AI.
              </p>

              <div className="flex justify-center gap-6 mb-24">
                <button 
                  onClick={() => setStep(clientId && (apiKey || import.meta.env.VITE_GEMINI_API_KEY) ? 'selection' : 'setup')}
                  className="btn-primary px-10 py-5 text-lg shadow-[0_0_40px_rgba(59,130,246,0.3)]"
                >
                  Get Started Now
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { icon: <Sparkles />, title: "AI Naming", desc: "Professional nomenclature for every file." },
                  { icon: <CheckCircle2 />, title: "Auto-Sorting", desc: "Intelligent folder categorization." },
                  { icon: <Settings />, title: "Custom Rules", desc: "Configurable patterns for your organization." }
                ].map((feat, i) => (
                  <div key={i} className="glass p-8 text-left border-white/5 bg-white/[0.02]">
                    <div className="text-blue-500 mb-4">{feat.icon}</div>
                    <h3 className="text-xl font-bold mb-2">{feat.title}</h3>
                    <p className="text-gray-500 text-sm">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'setup' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="glass p-12 text-center"
            >
              <div className="bg-blue-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8">
                <Settings className="text-blue-500 w-10 h-10" />
              </div>
              <h2 className="text-4xl font-bold mb-4">Initial Configuration</h2>
              <div className="flex flex-col gap-6 items-start text-left max-w-md mx-auto">
                <div className="w-full">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Gemini API Key</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="input-field w-full" placeholder="Enter key..." />
                </div>
                <div className="w-full">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Google Client ID</label>
                  <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} className="input-field w-full" placeholder="xxxx-xxxx.apps.googleusercontent.com" />
                </div>
                <button onClick={saveSettings} className="btn-primary w-full mt-4 py-4 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'selection' && (
            <motion.div 
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-12 text-center"
            >
              {!accessToken ? (
                <>
                  <div className="bg-blue-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8">
                    <FolderOpen className="text-blue-500 w-10 h-10" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4">Connect your Drive</h2>
                  <button onClick={handleGoogleLogin} className="btn-primary flex items-center gap-3 mx-auto px-10 py-5">
                    Login with Google
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-blue-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8">
                    <FolderSearch className="text-blue-500 w-10 h-10" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4">Select Source Folder</h2>
                  <div className="flex gap-4 max-w-md mx-auto">
                    <input type="text" value={folderId} onChange={e => setFolderId(e.target.value)} className="input-field flex-1" placeholder="Folder ID..." />
                    <button onClick={handleScan} disabled={processing} className="btn-primary">{processing ? 'Scanning...' : 'Scan Folder'}</button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-3xl font-bold">Optimization Plan</h2>
                  <div className="flex gap-4 mt-2">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold bg-white/5 px-2 py-1 rounded">
                      Tokens: {Object.values(plans).reduce((acc, p) => acc + (p.usage?.totalTokenCount || 0), 0)}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded">
                      Est. Cost: ${ (
                        (Object.values(plans).reduce((acc, p) => acc + (p.usage?.promptTokenCount || 0), 0) / 1000000 * 1.50) +
                        (Object.values(plans).reduce((acc, p) => acc + (p.usage?.candidatesTokenCount || 0), 0) / 1000000 * 9.00)
                      ).toFixed(4) }
                    </div>
                  </div>
                </div>
                <button onClick={handleOrganize} disabled={processing} className="btn-primary px-8 py-4 flex items-center gap-2">
                  Confirm & Organize <Sparkles className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {files.map(file => (
                  <FileItem key={file.id} file={file} plan={plans[file.id]} status={file.status} />
                ))}
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass p-16 text-center">
              <div className="bg-green-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="text-green-500 w-12 h-12" />
              </div>
              <h2 className="text-4xl font-bold mb-4">Mission Accomplished!</h2>
              <div className="mb-8 text-gray-400">
                <p>Process complete. Total investment in AI for this run:</p>
                <p className="text-2xl font-mono text-white mt-2">
                   ${ (
                        (Object.values(plans).reduce((acc, p) => acc + (p.usage?.promptTokenCount || 0), 0) / 1000000 * 1.50) +
                        (Object.values(plans).reduce((acc, p) => acc + (p.usage?.candidatesTokenCount || 0), 0) / 1000000 * 9.00)
                      ).toFixed(6) }
                </p>
              </div>
              <button onClick={() => { setStep('selection'); setFiles([]); setPlans({}); }} className="btn-primary px-10">Organize another folder</button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <footer className="py-8 text-center text-gray-600 text-xs tracking-widest uppercase font-bold">
        Built with Gemini 3.5 Flash & Antigravity
      </footer>
    </div>
  );
}
