export const createStudentAppState = ({ emptyStudent, emptyWorkout }) => ({
  currentStudent: emptyStudent,
  currentWorkout: emptyWorkout,
  studentAccesses: [],
  availableWorkouts: [],
  upcomingWorkouts: [],
  previousSessions: []
});
