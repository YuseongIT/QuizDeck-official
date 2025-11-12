import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import "./index.css";
import Login from "./Login";
import SignUp from "./SignUp";
import Dashboard from "./Dashboard";
import { AuthProvider } from "./AuthContext";
import PrivateRoute from "./PrivateRoute";
import Settings from "./Settings";
import Courses from "./Courses";
import QuizzesPage from "./pages/QuizzesPage";
import Friends from "./Friends";
import Announcements from "./Announcements";
import Activity from "./Activity";
import DiscoverCourses from "./DiscoverCourses";
// Legacy CreateCourse removed in favor of modal; route removed
import CreateQuiz from "./CreateQuiz";
import Profile from "./Profile";
import CourseManagementPage from "./pages/CourseManagementPage";
import ManageQuizContentPage from "./pages/ManageQuizContentPage";
import ToastProvider from "./ToastProvider";
import { FriendProvider } from "./FriendContext";
import AdminDashboard from "./AdminDashboard";

const LandingPage = () => {
  const [activeTab, setActiveTab] = useState("welcome");
  const [resModal, setResModal] = useState({ open:false, item:null });
  const [faqFlipIndex, setFaqFlipIndex] = useState(null);

  const creators = [
    { name: "John Ivan Roxas", img: "./ivan.jpg" },
    { name: "Althea Aeryn Dela Cruz", img: "./althea.png" },
    { name: "Ashley Avanica", img: "./ashley.jpg" },
    { name: "Josh Fangonilo", img: "./josh.jpg" },
  ];

  const faqs = [
    { q: 'What is QuizDeck?', a: 'QuizDeck is an interactive online study platform that boosts learning through active recall and self‑assessment by creating, sharing, and taking quizzes.' },
    { q: 'Who is QuizDeck for?', a: 'QuizDeck is for Teachers and Students, with two account types tailored to different learning environments.' },
    { q: 'Teacher vs Student accounts?', a: 'Teachers: create quizzes, manage classes, assign quizzes. Students: take assigned quizzes, and also create their own for personal study or sharing.' },
    { q: 'Can students make their own quizzes?', a: 'Yes! Students can build quizzes from scratch and share them with peers—great for active recall.' },
    { q: 'What question types are supported?', a: 'Identification, Multiple Choice, Multiple Answer, True/False, Ordering, Matching.' },
    { q: 'How does QuizDeck help me learn better?', a: 'It’s built on active recall—retrieving information strengthens long‑term retention far better than passive rereading.' },
    { q: 'How can I track my performance?', a: 'Progress Tracking records your results so you can monitor improvement and focus on topics that need review.' },
    { q: 'How do I get started?', a: 'Sign up securely as a Teacher or Student to get the right tools and jump into creating or taking quizzes.' },
  ];

  const resources = [
    {
      key: 'vscode',
      title: 'Visual Studio Code',
      description: 'The primary IDE used to build QuizDeck, enhanced with helpful extensions for faster, friendlier development.',
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Visual_Studio_Code_1.35_icon.svg/1200px-Visual_Studio_Code_1.35_icon.svg.png'
    },
    {
      key: 'laravel',
      title: 'Laravel',
      description: 'Our backend framework powering APIs, auth, and all the server-side magic with elegant syntax.',
      img: 'https://laravel.com/img/logomark.min.svg'
    },
    {
      key: 'react',
      title: 'React',
      description: 'The front-end library that makes QuizDeck feel fast, responsive, and interactive—built with HCI in mind.',
      img: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg'
    },
    {
      key: 'phpmysql',
      title: 'PHP / MySQL',
      description: 'Our foundation for data storage and business logic—securely storing users, quizzes, progress, and more.',
      img: 'https://www.php.net/images/logos/php-logo.svg'
    },
    {
      key: 'aws',
      title: 'AWS EC2',
      description: 'Cloud hosting that deploys QuizDeck to the world—scalable, reliable, and always-on.',
      img: 'https://cloudiofy.com/wp-content/uploads/2020/06/aws-ec2.png'
    },
  ];

  return (
    <div className="landing-container">
      <header className="landing-header">
        <h1 className="app-title">QuizDeck</h1>
        <nav className="nav-links">
          <Link to="/signup" className="btn-primary">Sign up</Link>
          <Link to="/login" className="btn-2nd">Log in</Link>
        </nav>
      </header>

      <section className="hero-section">
        <div className="trapezoid-tabs">
          <div
            className={`tab-group ${activeTab === "welcome" ? "active" : ""}`}
            onClick={() => setActiveTab("welcome")}
          >
            <div className="tab-image">
              <img src="./quizdeck.png" alt="Welcome" />
            </div>
            <div className="tab"><h2>Welcome</h2></div>
          </div>

          <div
            className={`tab-group ${activeTab === "getting" ? "active" : ""}`}
            onClick={() => setActiveTab("getting")}
          >
            <div className="tab-image">
              <img src="./getting.png" alt="Getting Started" />
            </div>
            <div className="tab"><h2>Getting Started</h2></div>
          </div>

          <div
            className={`tab-group ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            <div className="tab-image">
              <img src="./aboutus.png" alt="About Us" />
            </div>
            <div className="tab"><h2>About Us</h2></div>
          </div>
        </div>

        <div className="hero-text fade-in">
          {activeTab === "welcome" && (
            <>
              <h2>Welcome to <span className="highlight">QuizDeck!</span></h2>
              <p>
                QuizDeck is your go-to web platform for creating, sharing, and enjoying quizzes—perfect for students, teachers, and anyone who loves learning in a fun, interactive way.
              </p>
              <div className="info-card">
                <h3>✨ Why you’ll love QuizDeck:</h3>
                <ul>
                  <li><strong>Easy quiz creation:</strong> Build quizzes in just a few clicks—no complicated setup needed.</li>
                  <li><strong>Collaborate and share:</strong> Work with classmates, friends, or colleagues and see how everyone stacks up.</li>
                  <li><strong>Clean and intuitive design:</strong> Focus on learning without getting lost in cluttered menus or confusing interfaces.</li>
                </ul>
              </div>

              <div className="info-card">
                <h3>✨ Why you’ll love QuizDeck:</h3>
                <ul>
                  <li><strong>Easy quiz creation:</strong> Build quizzes in just a few clicks—no complicated setup needed.</li>
                  <li><strong>Collaborate and share:</strong> Work with classmates, friends, or colleagues and see how everyone stacks up.</li>
                  <li><strong>Clean and intuitive design:</strong> Focus on learning without getting lost in cluttered menus or confusing interfaces.</li>
                </ul>
              </div>

              <div className="info-card">
                <h3>💜 Who is QuizDeck for?</h3>
                <ul>
                <li><strong>Students –</strong> Learn smarter and test your knowledge.</li>
                  <li><strong>Teachers –</strong> Create quick, entertaining review quizzes.</li>
                  <li><strong>Friends –</strong> Play, compete, and have fun learning together.</li>
                  </ul>
              </div>
              <div className="welcome-footer">
                <h3>🎯 Get started today:</h3>
                <p>Jump in, create quizzes, compete with friends, and learn smarter—QuizDeck makes it easy and fun every step of the way.</p>
                <Link to="/login" className="btn-login">Get Started</Link>
              </div>

              
            </>
          )}

          {activeTab === "getting" && (
            <>
              <h2>Getting Started</h2>
              <p>Follow these simple steps to begin your journey with QuizDeck.</p>
              <div className="info-car">
                <h3 style={{ fontWeight: 900 }}>Steps to Get Started</h3>
                <div className="tutorial-steps" style={{ marginTop: 8 }}>
                  <div className="step"><h3>1️⃣ Sign Up or Log In</h3><p>Create your account.</p></div>
                  <div className="step"><h3>2️⃣ Create Your First Quiz</h3><p>Design and customize quizzes.</p></div>
                  <div className="step"><h3>3️⃣ Share & Compete</h3><p>Challenge your friends!</p></div>
                  <div className="step"><h3>4️⃣ Track & Improve</h3><p>Monitor your progress!</p></div>
                </div>
              </div>
              <br></br>
              <br></br>

              <div className="info-car" style={{ marginTop: 16 }}>
                <h3 style={{ fontWeight: 900 }}>Frequently Asked Questions</h3>
                <p style={{ marginTop: 6 }}>Hover or tap a card to flip and reveal the answer.</p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16,
                  marginTop: 12,
                }}>
                  {faqs.map((item, idx) => {
                    const flipped = faqFlipIndex === idx;
                    return (
                      <div key={idx}
                        onMouseEnter={() => setFaqFlipIndex(idx)}
                        onMouseLeave={() => setFaqFlipIndex(null)}
                        onClick={() => setFaqFlipIndex(flipped ? null : idx)}
                        style={{ perspective: '1000px' }}
                      >
                        <div style={{
                          position:'relative',
                          height: 170,
                          borderRadius: 16,
                          transformStyle: 'preserve-3d',
                          transition: 'transform .5s cubic-bezier(.2,.8,.2,1)',
                          transform: flipped ? 'rotateY(180deg) translateY(-2px)' : 'rotateY(0deg)',
                          boxShadow: flipped ? '0 26px 56px rgba(106,62,203,.25)' : '0 16px 36px rgba(0,0,0,.08)',
                          border: '2px solid #e6e0f4',
                          background: '#fff',
                        }}>
                          <div style={{
                            position:'absolute', inset:0, backfaceVisibility:'hidden',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            padding: 14, borderRadius: 16,
                          }}>
                            <div style={{ fontWeight: 900, textAlign:'center' }}>{item.q}</div>
                          </div>
                          <div style={{
                            position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            padding: 16, borderRadius: 16, background:'#6a3ecb', color:'#fff',
                          }}>
                            <div style={{ textAlign:'center' }}>{item.a}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              
            </>
        
          )}

          {activeTab === "about" && (
            <>
              <h2>Meet the Team Behind QuizDeck!</h2>
              <p>
                We are enthusiastic 3rd Year BSIT students from the Technological Institute of the Philippines, dedicated to making QuizDeck a platform where learning is more fun and enjoyable. Our goal is to create a community that makes studying more interactive, fun and accessible for everyone!
              </p>
              <div className="team-grid">
                {creators.map((member, index) => (
                  <div className="team-member" key={index}>
                    <img src={member.img} alt={member.name} />
                    <h3>{member.name}</h3>
                  </div>
                ))}
              </div>
              <div className="info-section">
                <div className="info-card">
                  <h3>💡 Our Mission</h3>
                  <p>To empower learners by providing a dynamic, user-friendly platform that transforms studying from passive review into an active and engaging process. We are dedicated to making effective learning accessible by offering intuitive tools for creating, practicing, and mastering knowledge through self-assessment and active recall.</p>
                </div>
                <div className="info-card">
                  <h3>🌟 Our Vision</h3>
                  <p>To be the leading study platform that revolutionizes how students learn, making active recall and self-testing a fundamental and enjoyable part of every learner's academic journey, leading to deeper understanding and long-term retention.</p>
                </div>
              </div>

              

              {/* Resources Used */}
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontWeight: 900 }}>Resources Used</h2>
                <p style={{ marginTop: 6 }}>Click a card to learn more about the tools behind QuizDeck.</p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  marginTop: 12,
                }}>
                  {resources.map((r) => (
                    <div key={r.key}
                      onClick={() => setResModal({ open:true, item:r })}
                      style={{
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 16px 36px rgba(0,0,0,0.08)',
                        padding: 14,
                        cursor: 'pointer',
                        transition: 'transform .14s ease, box-shadow .14s ease, filter .14s ease',
                        border: '2px solid #e6e0f4',
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 24px 48px rgba(106,62,203,.22)'; e.currentTarget.style.filter='saturate(1.1)'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 16px 36px rgba(0,0,0,0.08)'; e.currentTarget.style.filter='none'; }}
                    >
                      <div style={{ height: 150, display:'flex', alignItems:'center', justifyContent:'center', background:'#f7f5ff', borderRadius: 12, overflow:'hidden', border:'1px solid #eee' }}>
                        <img src={r.img} alt={r.title} style={{ maxWidth:'80%', maxHeight:'80%', objectFit:'contain' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>


      
    {/* Modal for resources */}
    {resModal.open && resModal.item && (
      <div onClick={()=>setResModal({ open:false, item:null })} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.32)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
        <div onClick={e=>e.stopPropagation()} style={{ width:560, maxWidth:'92vw', background:'#fff', borderRadius:16, boxShadow:'0 22px 56px rgba(0,0,0,.26)', overflow:'hidden', fontFamily:'Kodchasan, system-ui', transform:'translateY(-6px)', animation:'pop .18s ease-out' }}>
          <div style={{ background:'#6a3ecb', color:'#fff', fontWeight:900, padding:'12px 16px' }}>{resModal.item.title}</div>
          <div style={{ padding:16 }}>
            <div style={{ display:'flex', gap:14, alignItems:'center' }}>
              <div style={{ flex:'0 0 96px', height:96, background:'#f7f5ff', border:'1px solid #eee', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={resModal.item.img} alt={resModal.item.title} style={{ maxWidth:'80%', maxHeight:'80%', objectFit:'contain' }} />
              </div>
              <div style={{ fontSize:16, color:'#2d1c3f' }}>{resModal.item.description}</div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
              <button
                onClick={()=>setResModal({ open:false, item:null })}
                style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #6a3ecb', background:'#6a3ecb', color:'#fff', fontWeight:900, transition:'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='#ffae0b'; e.currentTarget.style.borderColor='#ffae0b'; e.currentTarget.style.color='#2d1c3f'; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.borderColor='#6a3ecb'; e.currentTarget.style.color='#fff'; }}
              >Close</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <ToastProvider>
      <FriendProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/courses" element={<PrivateRoute><Courses /></PrivateRoute>} />
        <Route path="/course/:id" element={<PrivateRoute><CourseManagementPage /></PrivateRoute>} />
        <Route path="/discover" element={<PrivateRoute><DiscoverCourses /></PrivateRoute>} />
        {false && <Route path="/create-course" element={<PrivateRoute roles={["teacher"]}><div /></PrivateRoute>} />}
        <Route path="/create-quiz" element={<PrivateRoute><CreateQuiz /></PrivateRoute>} />
        <Route path="/quizzes" element={<PrivateRoute><QuizzesPage /></PrivateRoute>} />
        <Route path="/friends" element={<PrivateRoute><Friends /></PrivateRoute>} />
        <Route path="/manage/quiz/:id" element={<PrivateRoute><ManageQuizContentPage /></PrivateRoute>} />
        <Route path="/announcements" element={<PrivateRoute><Announcements /></PrivateRoute>} />
        <Route path="/activity" element={<PrivateRoute><Activity /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/u/:username" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/admin/dashboard" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
      </Routes>
      </FriendProvider>
      </ToastProvider>
    </BrowserRouter>
  </AuthProvider>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
