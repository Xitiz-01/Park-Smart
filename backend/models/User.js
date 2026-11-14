const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Better Auth's user id; goes away with Better Auth at the end of Phase 5.
    authUserId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Clerk's user id (user_…), set when the account first signs in with
    // Clerk or arrives through the webhook.
    clerkId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    // Clerk sign-ups may have no phone yet; Better Auth sign-ups always do.
    phone: {
      type: String,
      required: [
        function phoneRequired() {
          return !this.clerkId;
        },
        'Phone number is required',
      ],
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    // What happens after sign-up. intendedRole is what the person picked
    // ("I want to park" / "I operate parking"); it never grants a role by
    // itself: a vendor applicant stays a customer until an admin approves.
    onboarding: {
      intendedRole: { type: String, enum: ['customer', 'vendor'], default: 'customer' },
      state: { type: String, enum: ['complete', 'vendor_applicant'], default: 'complete' },
    },
    // Clerk's updated_at of the data last applied, so an older webhook
    // delivery never overwrites newer data.
    clerkUpdatedAt: Date,
    // Set when the Clerk user is deleted; the account is deactivated, but
    // its bookings and ledger history stay.
    clerkDeletedAt: Date,
    role: {
      type: String,
      enum: ['customer', 'vendor', 'admin', 'super_admin'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// "active" or "suspended", derived from isActive so there's one source of truth.
userSchema.virtual('status').get(function status() {
  return this.isActive === false ? 'suspended' : 'active';
});

module.exports = mongoose.model('User', userSchema);
