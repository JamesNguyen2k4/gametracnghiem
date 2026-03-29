export function pickRandomFace(faces) {
    if (!Array.isArray(faces) || faces.length === 0) {
      return null;
    }
  
    const index = Math.floor(Math.random() * faces.length);
  
    return {
      index,
      face: faces[index]
    };
  }