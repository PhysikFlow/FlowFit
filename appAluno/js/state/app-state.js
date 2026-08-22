export const createStudentAppState = ({ emptyStudent, emptyWorkout }) => ({
  currentStudent: emptyStudent,
  currentWorkout: emptyWorkout,
  studentProfile: null,
  studentAccesses: [],
  availableWorkouts: [],
  upcomingWorkouts: [],
  previousSessions: []
});
