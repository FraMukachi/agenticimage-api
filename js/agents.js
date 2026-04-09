// ============================================
// AGENT MANAGEMENT
// ============================================

export const AGENTS = {
  BRAIN: { id: 'brain', name: 'Brain', emoji: '🧠', color: '#7c3aed' },
  VISION: { id: 'vision', name: 'Vision', emoji: '👁️', color: '#2563eb' },
  HEART: { id: 'heart', name: 'Heart', emoji: '❤️', color: '#db2777' },
  HANDS: { id: 'hands', name: 'Hands', emoji: '👐', color: '#059669' },
  ORCH: { id: 'orch', name: 'Orchestrator', emoji: '🎯', color: '#d97706' }
};

export function setAgentStatus(agentId, status, isThinking = false) {
  const statusEl = document.getElementById(`${agentId}Status`);
  const dotEl = document.getElementById(`${agentId}Dot`);
  const cardEl = document.getElementById(`${agentId}Card`);
  
  if (statusEl) statusEl.textContent = status;
  if (dotEl) dotEl.className = `status-dot${isThinking ? ' thinking' : ''}`;
  if (cardEl) {
    if (status === 'Idle') cardEl.classList.remove('active');
    else cardEl.classList.add('active');
  }
}

export function resetAllAgents() {
  ['brain', 'vision', 'heart', 'hands'].forEach(id => {
    setAgentStatus(id, 'Idle', false);
  });
}
