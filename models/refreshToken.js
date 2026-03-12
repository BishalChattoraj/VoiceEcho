import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token:            { type: String,  required: true, unique: true },
    expiresAt:        { type: Date,    required: true },
    revoked:          { type: Boolean, default: false },
    replacedByToken:  { type: String,  default: null },
    userAgent:        { type: String,  default: null },
    ipAddress:        { type: String,  default: null },
  },
  { timestamps: true }
);

// Auto-delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema);