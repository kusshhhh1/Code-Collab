import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getProjectsByOwner,
  createProject,
  createFile,
  getProjectById,
} from '../lib/storage';
import { createBranch } from '../lib/storage-advanced';
import {
  requestProjectAccess,
  hasProjectAccess,
  getUserProjects,
} from '../lib/storage-access';
import { Project } from '../types';
import { Plus, LogOut, Code2, Copy, ExternalLink } from 'lucide-react';
import backgroundImage from '../assets/pic1.png';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = () => {
    try {
      if (!user) return;
      
      // Get owned projects
      const ownedProjects = getProjectsByOwner(user.id);
      
      // Get projects user has access to
      const accessedProjectIds = getUserProjects(user.id);
      const accessedProjects = accessedProjectIds
        .map((id) => getProjectById(id))
        .filter((p): p is NonNullable<typeof p> => p !== null);
      
      // Combine and remove duplicates (in case user owns and has access)
      const allProjects = [...ownedProjects, ...accessedProjects];
      const uniqueProjects = Array.from(
        new Map(allProjects.map((p) => [p.id, p])).values()
      );
      
      // Sort by updated_at descending
      uniqueProjects.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setProjects(uniqueProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim() || !user) return;

    try {
      const project = createProject({
        name: newProjectName,
        owner_id: user.id,
      });

      // Create main branch
      createBranch({
        project_id: project.id,
        name: 'main',
        created_by: user.id,
        is_main: true,
      });

      // Create a default file
      createFile({
        project_id: project.id,
        file_name: 'main.py',
        content: 'print("Hello, CodeCollab!")',
      });

      setShowCreateModal(false);
      setNewProjectName('');
      navigate(`/editor/${project.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    }
  };

  const handleJoinProject = async () => {
    if (!roomId.trim() || !user) return;
    
    const projectId = roomId.trim();
    
    // Check if project exists
    const project = getProjectById(projectId);
    if (!project) {
      alert('Project not found. Please check the share code.');
      return;
    }
    
    // Check if user is the owner/admin
    if (project.owner_id === user.id || project.admin_id === user.id) {
      navigate(`/editor/${projectId}`);
      return;
    }
    
    // Check if user already has access
    if (hasProjectAccess(projectId, user.id)) {
      navigate(`/editor/${projectId}`);
      return;
    }
    
    // Request access
    requestProjectAccess(projectId, user.id, user.name);
    alert('Join request sent to project admin! You will be able to access the project once approved.');
    setRoomId(''); // Clear the input
  };

  const copyProjectLink = (projectId: string) => {
    // Copy only the project ID (share code), not the full URL
    navigator.clipboard.writeText(projectId);
    alert('Share code copied to clipboard!\n\nShare code: ' + projectId);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen text-white flex items-center justify-center"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-white relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      
      {/* Content */}
      <div className="relative z-10">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 rounded-lg flex items-center justify-center">
              <Code2 className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-600 bg-clip-text text-transparent">
              CodeCollab
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Welcome, {user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Actions */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New Project
          </button>

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Share Code (Project ID)"
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
              onKeyPress={(e) => e.key === 'Enter' && handleJoinProject()}
            />
            <button
              onClick={handleJoinProject}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              Request Access
            </button>
          </div>
        </div>

        {/* Projects List */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Your Projects</h2>
          {projects.length === 0 ? (
            <div className="bg-gray-900 rounded-lg p-12 text-center border border-gray-800">
              <p className="text-gray-400 mb-4">No projects yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200"
              >
                Create Your First Project
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-yellow-500 transition-colors cursor-pointer"
                  onClick={() => navigate(`/editor/${project.id}`)}
                >
                  <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyProjectLink(project.id);
                    }}
                    className="text-sm text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Share Code
                  </button>
                  {project.owner_id !== user?.id && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      Member
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 w-full max-w-md">
            <h2 className="text-2xl font-semibold mb-4">Create New Project</h2>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
              autoFocus
            />
            <div className="flex gap-4">
              <button
                onClick={handleCreateProject}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

