/**
 * Staff-side victim chat API (contract v0.4.2, API_SPEC §6.8, openapi.yaml).
 * Allows operators and supervisors to view victim-assistant threads and send staff replies.
 * Bank viewers have read-only permissions.
 */
import type {
  ApiErrorDetail,
  ApiResponse,
  ChatMessage,
  ChatThread,
  Language,
} from '@/types/api';
import { CHAT_TIMEOUT_MS, USE_MOCK, apiError, mockEnvelope, mockFailure, request } from './http';
import {
  actorOf,
  addAudit,
  currentUser,
  db,
  findVisibleCase,
  nowIso,
  saveCase,
} from './mockStore';

export interface StaffReplyRequest {
  body: string;
}

const MAX_BODY_LENGTH = 4000;

function mockGetThread(caseId: string): ChatThread {
  const c = findVisibleCase(caseId);
  return (
    db.chatThreads[c.reference] ?? {
      case_reference: c.reference,
      messages: [],
      victim_question_pending: false,
      assistant_available: true,
    }
  );
}

function mockReply(caseId: string, bodyText: string): ChatMessage {
  const user = currentUser();
  if (user.role === 'bank_viewer' || (user.role !== 'operator' && user.role !== 'supervisor')) {
    throw apiError('FORBIDDEN', 'Only operators and supervisors can send staff replies.');
  }

  // Contract v0.4.3: staff chat replies stay allowed on closed cases.
  const c = findVisibleCase(caseId);

  const existingThread = db.chatThreads[c.reference] ?? {
    case_reference: c.reference,
    messages: [],
    victim_question_pending: false,
    assistant_available: true,
  };

  const messageId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const language: Language = c.victim?.preferred_language ?? 'ja';

  const staffMessage: ChatMessage = {
    id: messageId,
    role: 'staff',
    body: bodyText,
    language,
    created_at: nowIso(),
    author: {
      id: user.id,
      name: user.name,
    },
    answer_type: null,
    citations: [],
    confidence: null,
    needs_staff: false,
    feedback: null,
  };

  db.chatThreads = {
    ...db.chatThreads,
    [c.reference]: {
      ...existingThread,
      messages: [...existingThread.messages, staffMessage],
      victim_question_pending: false,
    },
  };

  if (c.flags?.victim_question_pending) {
    saveCase({
      ...c,
      flags: {
        ...c.flags,
        victim_question_pending: false,
      },
    });
  }

  addAudit({
    actor: actorOf(user),
    action: 'chat.staff_replied',
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    summary: `Staff reply sent by ${user.name} in case ${c.reference}`,
    changes: null,
    metadata: { message_id: messageId },
  });

  return staffMessage;
}

export const staffChatApi = {
  getThread(caseId: string): Promise<ApiResponse<ChatThread>> {
    if (USE_MOCK) {
      try {
        const thread = mockGetThread(caseId);
        return mockEnvelope(thread);
      } catch (err) {
        return mockFailure(err as ApiErrorDetail);
      }
    }
    return request<ChatThread>(`/api/cases/${caseId}/chat`);
  },

  reply(caseId: string, input: string | StaffReplyRequest): Promise<ApiResponse<ChatMessage>> {
    const bodyText = (typeof input === 'string' ? input : input?.body ?? '').trim();
    if (!bodyText) {
      return mockFailure(apiError('VALIDATION_ERROR', 'Reply body cannot be empty.'));
    }
    if (bodyText.length > MAX_BODY_LENGTH) {
      return mockFailure(
        apiError('VALIDATION_ERROR', `Reply body exceeds ${MAX_BODY_LENGTH} characters limit.`)
      );
    }

    if (USE_MOCK) {
      try {
        const message = mockReply(caseId, bodyText);
        return mockEnvelope(message, 'Reply sent');
      } catch (err) {
        return mockFailure(err as ApiErrorDetail);
      }
    }

    return request<ChatMessage>(
      `/api/cases/${caseId}/chat/reply`,
      {
        method: 'POST',
        body: JSON.stringify({ body: bodyText }),
      },
      CHAT_TIMEOUT_MS
    );
  },
};
