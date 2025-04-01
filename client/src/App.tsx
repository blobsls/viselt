import { useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';
import { FiCopy, FiFolder, FiFile, FiDownload, FiUpload } from 'react-icons/fi';

type FileStructure = {
  name: string;
  type: 'file' | 'folder';
  children?: FileStructure[];
};

function App() {
  const [view, setView] = useState<'home' | 'editor'>('home');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<Record<string, string>>({});
  const [,setStructure] = useState<FileStructure[]>([]);
  const [currentFile, setCurrentFile] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  const createSession = async (customCode?: string) => {
    const code = customCode || generateRandomCode();
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code })
    });
    
    if (response.ok) {
      connectToSession(code);
    } else {
      setError('Failed to create session');
    }
  };

  const joinSession = () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }
    connectToSession(inviteCode);
  };

  const connectToSession = (code: string) => {
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      newSocket.emit('joinSession', code, (response: any) => {
        if (response.error) {
          setError(response.error);
          newSocket.disconnect();
        } else {
          setFiles(response.files);
          setStructure(response.structure);
          setCurrentFile('main.js');
          setView('editor');
        }
      });
    });
    
    newSocket.on('fileChanged', ({ path, content }: { path: string, content: string }) => {
      setFiles(prev => ({ ...prev, [path]: content }));
    });
    
    setSocket(newSocket);
  };

  const generateRandomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleFileChange = (value: string | undefined) => {
    if (!currentFile || !socket) return;
    socket.emit('fileChange', { 
      inviteCode, 
      path: currentFile, 
      content: value || '' 
    });
    setFiles(prev => ({ ...prev, [currentFile]: value || '' }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {view === 'home' ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-screen"
        >
          <motion.h1 
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            className="text-5xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600"
          >
            CollabCode
          </motion.h1>
          
          <div className="flex space-x-4 mb-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-blue-600 rounded-lg font-medium"
              onClick={() => createSession()}
            >
              Create Session
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-purple-600 rounded-lg font-medium"
              onClick={() => {
                const code = prompt('Enter custom invite code (leave blank for random)');
                if (code !== null) createSession(code || undefined);
              }}
            >
              Create Custom
            </motion.button>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-md"
          >
            <div className="flex mb-2">
              <input
                type="text"
                placeholder="Enter invite code"
                className="flex-1 px-4 py-2 bg-gray-700 rounded-l-lg focus:outline-none"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <button
                className="px-4 py-2 bg-green-600 rounded-r-lg font-medium"
                onClick={joinSession}
              >
                Join
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
          </motion.div>
        </motion.div>
      ) : (
        <div className="h-screen flex flex-col">
          <div className="bg-gray-800 p-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="font-mono bg-gray-700 px-2 py-1 rounded">
                {inviteCode}
              </span>
              <button className="text-gray-300 hover:text-white">
                <FiCopy />
              </button>
            </div>
            <div className="flex space-x-2">
              <button className="flex items-center space-x-1 bg-gray-700 px-3 py-1 rounded">
                <FiDownload /> <span>Export</span>
              </button>
              <button className="flex items-center space-x-1 bg-gray-700 px-3 py-1 rounded">
                <FiUpload /> <span>Import</span>
              </button>
            </div>
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            <div className="w-64 bg-gray-800 p-4 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Project Files</h3>
                <div className="flex space-x-2">
                  <button className="text-gray-400 hover:text-white">
                    <FiFolder />
                  </button>
                  <button className="text-gray-400 hover:text-white">
                    <FiFile />
                  </button>
                </div>
              </div>
              
              {/* File tree would be rendered here */}
              <div className="space-y-1">
                {Object.keys(files).map((file) => (
                  <div 
                    key={file}
                    className={`px-2 py-1 rounded cursor-pointer ${currentFile === file ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                    onClick={() => setCurrentFile(file)}
                  >
                    {file}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex-1">
              <Editor
                height="100%"
                language="javascript"
                theme="vs-dark"
                path={currentFile}
                value={files[currentFile] || ''}
                onChange={handleFileChange}
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;