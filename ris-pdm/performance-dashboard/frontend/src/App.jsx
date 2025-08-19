import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="bg-blue-600 text-white p-4">
          <h1 className="text-2xl font-bold">Performance Dashboard</h1>
        </header>
        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function HomePage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Welcome to Performance Dashboard</h2>
      <p>This is the main dashboard page.</p>
    </div>
  );
}

export default App;