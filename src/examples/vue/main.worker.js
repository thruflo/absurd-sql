import initSqlJs from '@jlongster/sql.js';
import { SQLiteFS } from '../../index';
import IndexedDBBackend from '../../indexeddb/backend';

// Database instance
let db = null;

// Initialize the SQLite database with IndexedDB backend
async function initDatabase() {
  try {
    // Initialize SQL.js
    const SQL = await initSqlJs({ locateFile: file => file });
    
    // Set up the filesystem
    const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
    SQL.register_for_idb(sqlFS);
    
    // Create directory and mount filesystem
    SQL.FS.mkdir('/sql');
    SQL.FS.mount(sqlFS, {}, '/sql');
    
    // Database path
    const path = '/sql/notes.sqlite';
    
    // Handle browsers without SharedArrayBuffer
    if (typeof SharedArrayBuffer === 'undefined') {
      let stream = SQL.FS.open(path, 'a+');
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
    }
    
    // Open the database
    db = new SQL.Database(path, { filename: true });
    
    // Set pragmas for better performance
    db.exec(`
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=8192;
    `);
    
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    
    // Notify main thread that database is ready
    self.postMessage({ type: 'db-ready' });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, action, data, id } = event.data;
  
  if (type === 'init') {
    await initDatabase();
    return;
  }
  
  if (!db) {
    self.postMessage({ 
      type: 'error', 
      message: 'Database not initialized',
      id 
    });
    return;
  }
  
  try {
    let result;
    
    switch (action) {
      case 'getNotes':
        result = db.exec('SELECT * FROM notes ORDER BY created_at DESC');
        self.postMessage({ 
          type: 'result', 
          result: result[0] ? {
            columns: result[0].columns,
            values: result[0].values
          } : { columns: [], values: [] },
          id 
        });
        break;
        
      case 'addNote':
        db.exec({
          sql: 'INSERT INTO notes (title, content, created_at) VALUES (?, ?, ?)',
          bind: [data.title, data.content, Date.now()]
        });
        self.postMessage({ type: 'success', id });
        break;
        
      case 'updateNote':
        db.exec({
          sql: 'UPDATE notes SET title = ?, content = ? WHERE id = ?',
          bind: [data.title, data.content, data.id]
        });
        self.postMessage({ type: 'success', id });
        break;
        
      case 'deleteNote':
        db.exec({
          sql: 'DELETE FROM notes WHERE id = ?',
          bind: [data.id]
        });
        self.postMessage({ type: 'success', id });
        break;
        
      case 'getStats':
        result = db.exec('SELECT COUNT(*) as count FROM notes');
        self.postMessage({ 
          type: 'result', 
          result: result[0] ? result[0].values[0][0] : 0,
          id 
        });
        break;
        
      default:
        self.postMessage({ 
          type: 'error', 
          message: `Unknown action: ${action}`,
          id 
        });
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      message: error.message,
      id 
    });
  }
});

// Initialize the database when the worker starts
initDatabase();

