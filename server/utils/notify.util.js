import Notification from "../models/notification.model.js";

export const sendNotification = async (userId, title, message, type = "SYSTEM", io = null) => {
  const notification = await Notification.create({
    recipientUser: userId,   // Schema me 'user' ya 'recipientUser' ka use? Make consistent
    title,
    message,
    type,
  });

  // Transform _id → id for consistency
  const notifData = {
    ...notification.toJSON(), // applies toJSON transform from schema
  };

  // 🔥 Realtime push via socket.io
  if (io) {
    io.to(userId.toString()).emit("notification", notifData);
  }

  return notifData;
};
