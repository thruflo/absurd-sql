import { createApp } from 'vue';
import App from './App.vue';
import { initBackend } from '../../indexeddb/main-thread';

// Initialize the worker and backend
const worker = new Worker(new URL('./main.worker.js', import.meta.url));
initBackend(worker);

// Create a global reference to the worker for components to use
window.sqlWorker = worker;

// Create and mount the Vue application
const app = createApp(App);
app.mount('#app');

