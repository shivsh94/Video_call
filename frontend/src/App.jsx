import {Routes, Route} from 'react-router-dom'
// import './App.css'

import Room from './screens/Room'
import Home from '../src/pages/Home'

function App() {
  

  return (
    <div>
    <Routes>
     
      <Route path="/" element={<Home />} /> 

      <Route path="/room/:roomId" element={<Room />} />
    </Routes>
    </div>
  )
}

export default App
