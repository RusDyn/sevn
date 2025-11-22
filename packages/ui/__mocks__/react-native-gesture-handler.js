const noOp = () => ({
  minDistance: () => ({
    onUpdate: () => ({
      onEnd: () => ({}),
    }),
  }),
});

export const GestureDetector = ({ children }) => children;
export const Gesture = { Pan: noOp };
export default {};
