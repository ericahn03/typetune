import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Callback from './pages/Callback';
import Result from './pages/Result';
import Lyrics from './pages/Lyrics';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/result/:resultId/shared" element={<Result />} />
        <Route path="/result/:resultId" element={<Result />} />
        <Route path="/result" element={<Result />} />
        <Route path="/lyrics/:trackId" element={<Lyrics />} />
      </Routes>
    </Router>
  );
}

export default App;
