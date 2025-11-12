import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import TeacherDashboard from '../components/courses/TeacherDashboard';
import StudentDashboard from '../components/courses/StudentDashboard';

export default function Dashboard() {
  const { user, token } = useAuth() || {};
  const [role, setRole] = useState(user?.role || 'student');

  useEffect(() => { if (user?.role) setRole(user.role); }, [user]);

  return (
    <div style={{ fontFamily: 'Kodchasan, system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
      {role === 'teacher' ? (
        <TeacherDashboard token={token} />
      ) : (
        <StudentDashboard token={token} />
      )}
    </div>
  );
}
