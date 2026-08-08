// ============================================
// CONFIG — edit this to add/rename topics.
// Each topic points at a JSON file in /data
// ============================================
const TOPICS = [
  { id: 'sql',        name: 'SQL',                 icon: '◱', file: 'data/sql.json' },
  { id: 'excel',       name: 'Excel',                icon: '◱', file: 'data/excel.json' },
  { id: 'powerbi',     name: 'Power BI',             icon: '◱', file: 'data/powerbi.json' },
  { id: 'python',      name: 'Python',               icon: '◱', file: 'data/python.json' },
  { id: 'statistics',  name: 'Statistics',           icon: '◱', file: 'data/statistics.json' },
  { id: 'project',     name: 'Project-Based Qs',     icon: '◱', file: 'data/project-questions.json' },
  { id: 'scenario',    name: 'Scenario-Based Qs',    icon: '◱', file: 'data/scenario-questions.json' },
];


const FORMSPREE_ENDPOINT_ID = 'xkjwordw';

const dataCache = {};

async function loadTopicData(topicId) {
  if (dataCache[topicId]) return dataCache[topicId];
  const topic = TOPICS.find(t => t.id === topicId);
  if (!topic) return null;
  try {
    const res = await fetch(topic.file);
    const json = await res.json();
    dataCache[topicId] = json;
    return json;
  } catch (e) {
    console.error('Failed to load topic data:', topicId, e);
    return { questions: [] };
  }
}

async function loadAllTopicsData() {
  const all = {};
  await Promise.all(TOPICS.map(async t => {
    all[t.id] = await loadTopicData(t.id);
  }));
  return all;
}
