<template>
  <div class="container">
    <div class="header">
      <h1>Absurd-SQL with Vue.js</h1>
      <p>A persistent SQLite notes app using IndexedDB as storage</p>
    </div>
    
    <div class="card">
      <h2>Add a New Note</h2>
      <div class="form-group">
        <label for="title">Title</label>
        <input 
          id="title" 
          v-model="newNote.title" 
          placeholder="Enter note title"
          :disabled="!dbReady"
        />
      </div>
      <div class="form-group">
        <label for="content">Content</label>
        <textarea 
          id="content" 
          v-model="newNote.content" 
          rows="4" 
          placeholder="Enter note content"
          :disabled="!dbReady"
        ></textarea>
      </div>
      <button @click="addNote" :disabled="!dbReady || !newNote.title">
        Add Note
      </button>
      <button @click="clearForm" :disabled="!dbReady">
        Clear
      </button>
    </div>
    
    <div v-if="!dbReady" class="card">
      <p>Initializing database...</p>
    </div>
    
    <div v-else-if="loading" class="card">
      <p>Loading notes...</p>
    </div>
    
    <div v-else-if="notes.length === 0" class="card">
      <p>No notes yet. Add your first note above!</p>
    </div>
    
    <div v-else class="card">
      <h2>Your Notes</h2>
      <div v-for="note in notes" :key="note.id" class="note">
        <div>
          <h3>{{ note.title }}</h3>
          <p>{{ note.content }}</p>
          <small>Created: {{ formatDate(note.created_at) }}</small>
        </div>
        <div class="note-actions">
          <button class="delete-btn" @click="deleteNote(note.id)">Delete</button>
        </div>
      </div>
      
      <div class="stats">
        <p>Total notes: {{ noteCount }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      dbReady: false,
      loading: true,
      notes: [],
      noteCount: 0,
      newNote: {
        title: '',
        content: ''
      },
      worker: null
    };
  },
  mounted() {
    // Get the worker reference
    this.worker = window.sqlWorker;
    
    // Set up event listener for worker messages
    this.worker.addEventListener('message', this.handleWorkerMessage);
    
    // Initialize the database
    this.worker.postMessage({ type: 'init' });
  },
  beforeUnmount() {
    // Clean up event listener
    this.worker.removeEventListener('message', this.handleWorkerMessage);
  },
  methods: {
    handleWorkerMessage(event) {
      const { type, result, message, id } = event.data;
      
      switch (type) {
        case 'db-ready':
          this.dbReady = true;
          this.fetchNotes();
          this.fetchStats();
          break;
          
        case 'result':
          if (id === 'getNotes') {
            this.processNotes(result);
          } else if (id === 'getStats') {
            this.noteCount = result;
          }
          this.loading = false;
          break;
          
        case 'success':
          if (id === 'addNote' || id === 'deleteNote') {
            this.fetchNotes();
            this.fetchStats();
          }
          break;
          
        case 'error':
          console.error('Database error:', message);
          alert(`Error: ${message}`);
          this.loading = false;
          break;
      }
    },
    
    fetchNotes() {
      this.loading = true;
      this.worker.postMessage({ 
        action: 'getNotes',
        id: 'getNotes'
      });
    },
    
    fetchStats() {
      this.worker.postMessage({ 
        action: 'getStats',
        id: 'getStats'
      });
    },
    
    processNotes(result) {
      if (!result.columns || !result.values) {
        this.notes = [];
        return;
      }
      
      // Convert the result to an array of objects
      this.notes = result.values.map(row => {
        const note = {};
        result.columns.forEach((col, index) => {
          note[col] = row[index];
        });
        return note;
      });
    },
    
    addNote() {
      if (!this.newNote.title) return;
      
      this.worker.postMessage({
        action: 'addNote',
        data: {
          title: this.newNote.title,
          content: this.newNote.content
        },
        id: 'addNote'
      });
      
      this.clearForm();
    },
    
    deleteNote(id) {
      if (confirm('Are you sure you want to delete this note?')) {
        this.worker.postMessage({
          action: 'deleteNote',
          data: { id },
          id: 'deleteNote'
        });
      }
    },
    
    clearForm() {
      this.newNote = {
        title: '',
        content: ''
      };
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString();
    }
  }
};
</script>

