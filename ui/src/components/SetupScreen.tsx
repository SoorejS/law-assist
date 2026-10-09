import React, { useState } from "react";
import { setupWorkspace } from "../lib/api";

export function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({ firm_name: "", admin_name: "", admin_username: "", master_password: "", vertical: "law_firm" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await setupWorkspace(form);
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome to ProAssist</h2>
        <p className="text-slate-300 mb-8">Let's set up your firm's local workspace.</p>
        
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4 text-sm border border-red-500/50">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Firm Name</label>
            <input className="w-full bg-slate-800/50 text-white border border-slate-600 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="e.g. Krishna Legal Associates" value={form.firm_name} onChange={e => setForm({...form, firm_name: e.target.value})} required />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Admin Full Name</label>
            <input className="w-full bg-slate-800/50 text-white border border-slate-600 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Your name" value={form.admin_name} onChange={e => setForm({...form, admin_name: e.target.value})} required />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Admin Username</label>
            <input className="w-full bg-slate-800/50 text-white border border-slate-600 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="username" value={form.admin_username} onChange={e => setForm({...form, admin_username: e.target.value})} required />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Master Password</label>
            <input className="w-full bg-slate-800/50 text-white border border-slate-600 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="password" placeholder="••••••••" value={form.master_password} onChange={e => setForm({...form, master_password: e.target.value})} required />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Profession / Vertical</label>
            <select className="w-full bg-slate-800/50 text-white border border-slate-600 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none" value={form.vertical} onChange={e => setForm({...form, vertical: e.target.value})}>
              <option value="law_firm">⚖️ Legal (Law Firms, Advocates)</option>
              <option value="ca_firm">📊 Finance (Chartered Accountants)</option>
              <option value="medical">🏥 Healthcare (Doctors, Clinics)</option>
              <option value="generic">🏢 Generic Enterprise</option>
            </select>
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-3 mt-4 font-bold transition-colors shadow-lg" type="submit" disabled={loading}>
            {loading ? "Initializing..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
