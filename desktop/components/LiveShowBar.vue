<template>
  <div v-if="isLive && liveEvent" class="live-show-bar">
    <div class="live-show-bar-countdown" aria-live="polite">
      <div class="live-show-bar-countdown-copy">
        <span class="live-show-bar-countdown-label">Time left</span>
        <span class="live-show-bar-countdown-value">{{ countdownLabel }}</span>
      </div>
    </div>

    <div class="live-show-bar-actions">
      <button
        class="btn btn-secondary live-show-bar-btn"
        :disabled="acting || !canExtend"
        type="button"
        @click="openExtendModal"
      >
        Extend show
      </button>
      <button
        class="btn btn-primary live-show-bar-btn live-show-bar-btn--end"
        :disabled="acting"
        type="button"
        @click="openEndModal"
      >
        End show
      </button>
    </div>

    <p v-if="actionError && !extendModalOpen && !endModalOpen" class="live-show-bar-error">
      {{ actionError }}
    </p>
  </div>

  <Teleport to="body">
    <div
      v-if="endModalOpen"
      class="modal-backdrop"
      @click.self="closeEndModal"
    >
      <div
        class="modal-card end-show-modal"
        role="dialog"
        aria-labelledby="end-show-title"
        aria-modal="true"
      >
        <div class="eyebrow">End show</div>
        <h2 id="end-show-title" style="margin: 0; font-size: 1.8rem">End this show now?</h2>
        <p class="muted" style="margin: 0">Fans will no longer be able to request songs.</p>

        <p v-if="actionError" class="live-show-bar-error">{{ actionError }}</p>

        <div class="btn-row" style="margin-top: 4px">
          <button class="btn btn-secondary" type="button" :disabled="acting" @click="closeEndModal">
            Cancel
          </button>
          <button
            class="btn btn-primary live-show-bar-btn--end"
            :disabled="acting"
            type="button"
            @click="confirmEnd"
          >
            End show
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="extendModalOpen"
      class="modal-backdrop"
      @click.self="closeExtendModal"
    >
      <div
        class="modal-card extend-show-modal"
        role="dialog"
        aria-labelledby="extend-show-title"
        aria-modal="true"
      >
        <div class="eyebrow">Extend show</div>
        <h2 id="extend-show-title" style="margin: 0; font-size: 1.8rem">Add more time</h2>
        <p class="muted" style="margin: 0">Choose how much longer this show should stay live.</p>

        <div class="extend-show-options">
          <button
            v-for="option in extendOptions"
            :key="option.value"
            class="btn btn-secondary extend-show-option"
            :disabled="acting || !canExtendBy(option.value)"
            type="button"
            @click="handleExtend(option.value)"
          >
            +{{ option.label }}
          </button>
        </div>

        <p v-if="!canExtend" class="extend-show-note">This show is already at the maximum duration.</p>
        <p v-if="actionError" class="live-show-bar-error">{{ actionError }}</p>

        <div class="btn-row" style="margin-top: 4px">
          <button class="btn btn-secondary" type="button" :disabled="acting" @click="closeExtendModal">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const {
  liveEvent,
  isLive,
  countdownLabel,
  canExtend,
  canExtendBy,
  extendOptions,
  acting,
  actionError,
  endShow,
  extendShow,
  clearActionError,
} = useLiveShow();

const extendModalOpen = ref(false);
const endModalOpen = ref(false);

function openExtendModal() {
  clearActionError();
  extendModalOpen.value = true;
}

function closeExtendModal() {
  if (acting.value) {
    return;
  }

  extendModalOpen.value = false;
}

function openEndModal() {
  clearActionError();
  endModalOpen.value = true;
}

function closeEndModal() {
  if (acting.value) {
    return;
  }

  endModalOpen.value = false;
}

async function confirmEnd() {
  try {
    await endShow();
    endModalOpen.value = false;
  } catch {
    // Keep the modal open so the DJ can retry or cancel.
  }
}

async function handleExtend(minutes: number) {
  try {
    await extendShow(minutes);
    extendModalOpen.value = false;
  } catch {
    // Keep the modal open so the DJ can retry or cancel.
  }
}
</script>

<style scoped>
.live-show-bar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  margin: 0;
  max-width: 100%;
  width: fit-content;
}

.live-show-bar-countdown {
  align-items: center;
  border: 1.5px solid var(--rqst-coral);
  border-radius: var(--rqst-radius-md);
  display: flex;
  padding: 8px 28px;
}

.live-show-bar-countdown-copy {
  display: grid;
  gap: 2px;
  text-align: right;
}

.live-show-bar-countdown-label {
  color: var(--rqst-ink-muted);
  font-size: 0.45rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.live-show-bar-countdown-value {
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}

.live-show-bar-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.live-show-bar-btn {
  min-width: 118px;
}

.live-show-bar-btn--end {
  background: var(--rqst-coral);
  border-color: rgba(255, 255, 255, 0.24);
  color: var(--rqst-text);
}

.live-show-bar-error {
  color: #b42318;
  flex: 1 1 100%;
  font-size: 0.84rem;
  margin: 0;
  text-align: right;
  width: 100%;
}

.extend-show-modal,
.end-show-modal {
  max-width: 420px;
}

.extend-show-options {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.extend-show-option {
  justify-content: center;
  min-width: 0;
  padding-inline: 10px;
}

.extend-show-note {
  color: var(--rqst-ink-muted);
  font-size: 0.84rem;
  margin: 0;
}

:global([data-theme="dark"]) .live-show-bar-btn--end {
  background: rgba(255, 93, 93, 0.92);
}

:global([data-theme="dark"]) .live-show-bar-error {
  color: #ff8a8a;
}

@media (max-width: 760px) {
  .live-show-bar {
    justify-content: stretch;
    width: 100%;
  }

  .live-show-bar-countdown,
  .live-show-bar-actions {
    width: 100%;
  }

  .live-show-bar-countdown {
    justify-content: space-between;
  }

  .live-show-bar-btn {
    flex: 1 1 140px;
  }

  .extend-show-options {
    grid-template-columns: 1fr;
  }
}
</style>
