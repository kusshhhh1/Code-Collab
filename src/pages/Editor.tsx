import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getProjectById,
  getFilesByProject,
  getFileById,
  updateFile,
  createFile,
  deleteFile,
  getMessagesByProject,
  createMessage,
  getUserById,
} from '../lib/storage';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import Editor from '@monaco-editor/react';
import { File as FileType, Project, Language, Message } from '../types';
import { 
  Plus, Trash2, Edit2, Check, X, Play, Share2, 
  ArrowLeft, LogOut, Send, File
} from 'lucide-react';

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileType[]>([]);
  const [activeFile, setActiveFile] = useState<FileType | null>(null);
  const [language, setLanguage] = useState<Language>('python');
  const [output, setOutput] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  
  const editorRef = useRef<any>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !projectId) {
      navigate('/login');
      return;
    }

    // Setup socket - it will call loadProject once connected
    setupSocket();

    return () => {
      disconnectSocket();
    };
  }, [projectId, user]);

  const loadProject = () => {
    try {
      if (!projectId) return;

      // Try to load from local storage first
      let projectData = getProjectById(projectId);
      let filesData = getFilesByProject(projectId);
      let messagesData = getMessagesByProject(projectId);

      // If project exists locally, use it and share with server
      if (projectData) {
        setProject(projectData);
        filesData.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setFiles(filesData);
        
        if (filesData.length > 0) {
          setActiveFile(filesData[0]);
          detectLanguage(filesData[0].file_name);
        }

        // Share project data with server for collaboration
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('share-project-data', {
            project: projectData,
            files: filesData,
            messages: messagesData,
          });
        }

        loadChatMessages();
      } else {
        // Project doesn't exist locally - request from server/other users
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('request-project-data');
          
          socket.once('project-data', (data: any) => {
            if (data && data.project) {
              // Create local copy of shared project
              setProject(data.project);
              
              if (data.files && data.files.length > 0) {
                // Import files into local storage
                data.files.forEach((file: FileType) => {
                  const existing = getFileById(file.id);
                  if (!existing) {
                    createFile({
                      project_id: file.project_id,
                      file_name: file.file_name,
                      content: file.content,
                    });
                  }
                });
                
                const sortedFiles = [...data.files].sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                setFiles(sortedFiles);
                if (sortedFiles.length > 0) {
                  setActiveFile(sortedFiles[0]);
                  detectLanguage(sortedFiles[0].file_name);
                }
              }

              if (data.messages) {
                // Import messages into local storage
                data.messages.forEach((msg: Message) => {
                  const existing = getMessagesByProject(projectId).find(m => m.id === msg.id);
                  if (!existing) {
                    createMessage({
                      project_id: msg.project_id,
                      user_id: msg.user_id,
                      content: msg.content,
                    });
                  }
                });
                loadChatMessages();
              }
            } else {
              // No one has shared this project yet
              setOutput('Waiting for project owner to join...\n\nIf you are the owner, please create this project first from your dashboard.');
            }
          });
        } else {
          // Socket not connected yet, wait a bit and try again
          setTimeout(() => {
            loadProject();
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error loading project:', error);
      alert('Failed to load project');
    }
  };

  const loadChatMessages = () => {
    try {
      if (!projectId) return;
      const messages = getMessagesByProject(projectId);
      // Enrich messages with user names
      const enrichedMessages = messages.map((msg) => {
        const user = getUserById(msg.user_id);
        return { ...msg, user_name: user?.name };
      });
      enrichedMessages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setChatMessages(enrichedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const setupSocket = () => {
    if (!projectId || !user) return;

    const socket = connectSocket(projectId, user.id);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket');
      // Once connected, load project (which may request data)
      loadProject();
    });

    socket.on('code-change', (data: { fileId: string; content: string }) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
      );
      if (activeFile?.id === data.fileId) {
        setActiveFile((prev) => (prev ? { ...prev, content: data.content } : null));
      }
    });

    socket.on('file-created', (file: FileType) => {
      setFiles((prev) => [...prev, file]);
    });

    socket.on('file-deleted', (fileId: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFile?.id === fileId && files.length > 1) {
        const remaining = files.filter((f) => f.id !== fileId);
        setActiveFile(remaining[0] || null);
      }
    });

    socket.on('new-message', (message: Message) => {
      setChatMessages((prev) => [...prev, message]);
    });
  };

  const detectLanguage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'py') setLanguage('python');
    else if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') setLanguage('javascript');
    else if (ext === 'cpp' || ext === 'cxx' || ext === 'cc' || ext === 'c') setLanguage('cpp');
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile || !value) return;

    const updatedFile = { ...activeFile, content: value };
    setActiveFile(updatedFile);
    setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? updatedFile : f)));

    // Sync via socket
    const socket = getSocket();
    if (socket) {
      socket.emit('code-change', {
        fileId: activeFile.id,
        content: value,
      });
    }

    // Update in storage
    updateFile(activeFile.id, { content: value });
  };

  const handleCreateFile = () => {
    if (!newFileName.trim() || !projectId) return;

    const ext = newFileName.split('.').pop();
    const fileName = ext ? newFileName : `${newFileName}.py`;

    try {
      const newFile = createFile({
        project_id: projectId,
        file_name: fileName,
        content: getDefaultContent(fileName),
      });

      setFiles((prev) => [...prev, newFile]);
      setActiveFile(newFile);
      detectLanguage(fileName);
      setNewFileName('');
      setShowNewFileInput(false);

      // Notify via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('file-created', newFile);
      }
    } catch (error) {
      console.error('Error creating file:', error);
      alert('Failed to create file');
    }
  };

  const handleDeleteFile = (fileId: string) => {
    if (files.length === 1) {
      alert('Cannot delete the last file');
      return;
    }

    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      deleteFile(fileId);

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFile?.id === fileId) {
        const remaining = files.filter((f) => f.id !== fileId);
        setActiveFile(remaining[0] || null);
      }

      // Notify via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('file-deleted', fileId);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const handleRenameFile = (fileId: string) => {
    if (!editingName.trim()) return;

    try {
      const updated = updateFile(fileId, { file_name: editingName });
      if (!updated) {
        alert('Failed to rename file');
        return;
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? updated : f))
      );
      if (activeFile?.id === fileId) {
        setActiveFile(updated);
        detectLanguage(editingName);
      }

      setEditingFile(null);
      setEditingName('');
    } catch (error) {
      console.error('Error renaming file:', error);
      alert('Failed to rename file');
    }
  };

  const handleRunCode = async () => {
    if (!activeFile) return;

    setOutput('Running...\n');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeFile.content,
          language: language,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setOutput(data.output || data.error || 'No output');
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setOutput(
          'Error: Backend server is not running!\n\n' +
          'Please start the server by running:\n' +
          'npm run server\n\n' +
          'Open a new terminal and run this command, then try again.'
        );
      } else {
        setOutput(`Error: ${error instanceof Error ? error.message : 'Failed to execute code'}`);
      }
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !user || !projectId) return;

    try {
      const newMessage = createMessage({
        project_id: projectId,
        user_id: user.id,
        content: chatInput,
      });

      const messageWithUser = { ...newMessage, user_name: user.name };
      setChatMessages((prev) => [...prev, messageWithUser]);
      setChatInput('');

      // Notify via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('new-message', messageWithUser);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/editor/${projectId}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied to clipboard!');
  };

  const getDefaultContent = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'py') return 'print("Hello, CodeCollab!")';
    if (ext === 'js') return 'console.log("Hello, CodeCollab!");';
    if (ext === 'cpp') return '#include <iostream>\n\nint main() {\n    std::cout << "Hello, CodeCollab!" << std::endl;\n    return 0;\n}';
    return '';
  };

  if (!project || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Top Bar */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between bg-gray-900">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <h2 className="text-lg font-semibold">{project.name}</h2>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="cpp">C++</option>
          </select>

          <button
            onClick={handleRunCode}
            className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Run
          </button>

          <button
            onClick={copyShareLink}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>

          <button
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <button
              onClick={() => setShowNewFileInput(true)}
              className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New File
            </button>
          </div>

          {showNewFileInput && (
            <div className="p-4 border-b border-gray-800">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.py"
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500 mb-2"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateFile}
                  className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewFileInput(false);
                    setNewFileName('');
                  }}
                  className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${
                  activeFile?.id === file.id ? 'bg-gray-800' : ''
                }`}
                onClick={() => {
                  setActiveFile(file);
                  detectLanguage(file.file_name);
                }}
              >
                {editingFile === file.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-2 py-1 bg-black border border-gray-700 rounded text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleRenameFile(file.id);
                        if (e.key === 'Escape') {
                          setEditingFile(null);
                          setEditingName('');
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameFile(file.id)}
                      className="text-green-400 hover:text-green-300"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingFile(null);
                        setEditingName('');
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm truncate">{file.file_name}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFile(file.id);
                          setEditingName(file.file_name);
                        }}
                        className="p-1 hover:bg-gray-700 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          {activeFile ? (
            <div className="flex-1">
              <Editor
                height="100%"
                language={language}
                value={activeFile.content}
                onChange={handleEditorChange}
                theme="vs-dark"
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a file to start editing
            </div>
          )}

          {/* Output Panel */}
          <div className="h-48 bg-gray-900 border-t border-gray-800 p-4">
            <div className="text-sm font-semibold mb-2">Output</div>
            <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-auto h-full">
              {output || 'Output will appear here...'}
            </pre>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800 font-semibold">Chat</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="text-sm">
                <div className="text-yellow-500 font-semibold mb-1">
                  {msg.user_name || 'User'}
                </div>
                <div className="text-gray-300">{msg.content}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

