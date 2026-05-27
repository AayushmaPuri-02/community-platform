const POST_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "misinformation", label: "Misinformation" },
  { value: "harassment", label: "Harassment" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "scam_fraud", label: "Scam / fraud" },
  { value: "inappropriate", label: "Inappropriate content" },
];

const ACCOUNT_REASONS = [
  { value: "fake_profile", label: "Fake or misleading profile" },
  { value: "harassment", label: "Harassment or abusive behavior" },
  { value: "spam_messages", label: "Spam or unwanted messages" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "other", label: "Other" },
];

const LABELS = {};
[...POST_REASONS, ...ACCOUNT_REASONS].forEach((r) => {
  LABELS[r.value] = r.label;
});

function getReasonLabel(reason) {
  return LABELS[reason] || (reason || "").replace(/_/g, " ");
}

function isValidPostReason(reason) {
  return POST_REASONS.some((r) => r.value === reason);
}

function isValidAccountReason(reason) {
  return ACCOUNT_REASONS.some((r) => r.value === reason);
}

module.exports = {
  POST_REASONS,
  ACCOUNT_REASONS,
  getReasonLabel,
  isValidPostReason,
  isValidAccountReason,
};
