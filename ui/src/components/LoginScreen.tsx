import React, { useEffect, useState } from "react";
import { fetchProfiles, login } from "../lib/api";

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfiles().then(setProfiles).catch(console.error);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = await login(selectedUser.username, password);
      localStorage.setItem("auth_token", token);
      onLogin();
    } catch (err: any) {
      setError("Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (selectedUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-sm text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg ring-4 ring-slate-800">
            {selectedUser.full_name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{selectedUser.full_name}</h2>
          <p className="text-slate-400 mb-6 uppercase text-sm font-semibold tracking-wider">{selectedUser.role.replace("_", " ")}</p>
          
          {error && <div className="text-red-400 mb-4 text-sm bg-red-900/20 p-2 rounded">{error}</div>}
          
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              autoFocus 
              className="w-full bg-slate-800 text-white border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg p-3 mb-6 text-center text-lg outline-none transition-all placeholder:text-slate-500" 
              placeholder="Enter Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
            <div className="flex gap-3">
              <button type="button" className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg p-3 font-medium transition-colors" onClick={() => { setSelectedUser(null); setPassword(""); setError(""); }}>
                Cancel
              </button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-3 font-medium transition-colors shadow-lg shadow-blue-900/50" disabled={loading}>
                {loading ? "..." : "Login"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen items-center justify-center bg-slate-950 px-4">
      <div className="absolute top-8 left-8">
        <h2 className="text-slate-400 text-xl font-bold tracking-widest uppercase">ProAssist</h2>
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-16 tracking-tight">Who is working?</h1>
      <div className="flex flex-wrap justify-center gap-10 max-w-5xl">
        {profiles.map(p => (
          <div key={p.id} className="flex flex-col items-center cursor-pointer group w-32" onClick={() => setSelectedUser(p)}>
            <div className="w-32 h-32 bg-slate-800 group-hover:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-white text-5xl font-bold transition-all duration-300 shadow-xl group-hover:shadow-2xl group-hover:scale-105 group-hover:ring-4 ring-blue-500/50">
              {p.full_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-slate-400 mt-6 text-lg group-hover:text-white font-medium transition-colors text-center w-full truncate">{p.full_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
