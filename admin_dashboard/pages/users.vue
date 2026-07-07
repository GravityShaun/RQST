<script setup lang="ts">
import type { AdminUser, UserRole } from "~/lib/admin-api";

const admin = useAdminConsole();
const query = ref("");
const userType = ref<"all" | "artist" | "normal" | "admin">("all");
const showDeleted = ref(true);
type SortColumn = "user" | "role" | "verified" | "requests" | "paid" | "status";
type SortDirection = "asc" | "desc";

const sortColumn = ref<SortColumn>("user");
const sortDirection = ref<SortDirection>("asc");
const pendingDelete = ref<AdminUser | null>(null);
const deleting = ref(false);

const roleLabels: Record<UserRole, string> = {
  listener: "Listener",
  dj: "DJ",
  admin: "Admin",
};

onMounted(async () => {
  await admin.bootstrap();
  if (admin.isAuthenticated.value && !admin.state.value.users.length) await admin.refreshSection("users");
});

const filteredUsers = computed(() => {
  const search = query.value.trim().toLowerCase();
  return admin.state.value.users.filter((user) => {
    const matchesSearch =
      !search ||
      user.email.toLowerCase().includes(search) ||
      user.displayName.toLowerCase().includes(search) ||
      String(user.id).includes(search);
    const matchesType =
      userType.value === "all" ||
      (userType.value === "artist" && user.role === "dj") ||
      (userType.value === "normal" && user.role === "listener") ||
      (userType.value === "admin" && user.role === "admin");
    const matchesDeleted = showDeleted.value || !user.deletedAt;
    return matchesSearch && matchesType && matchesDeleted;
  });
});

const sortedUsers = computed(() => {
  const users = [...filteredUsers.value];
  const direction = sortDirection.value === "asc" ? 1 : -1;

  users.sort((a, b) => {
    switch (sortColumn.value) {
      case "user":
        return `${a.displayName} ${a.email}`.localeCompare(`${b.displayName} ${b.email}`, undefined, {
          sensitivity: "base",
        }) * direction;
      case "role":
        return a.role.localeCompare(b.role) * direction;
      case "verified":
        return (Number(a.isEmailVerified) - Number(b.isEmailVerified)) * direction;
      case "requests":
        return (a.requestCount - b.requestCount) * direction;
      case "paid":
        return (a.paymentTotalCents - b.paymentTotalCents) * direction;
      case "status":
        return (Number(Boolean(a.deletedAt)) - Number(Boolean(b.deletedAt))) * direction;
      default:
        return 0;
    }
  });

  return users;
});

function toggleSort(column: SortColumn) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortColumn.value = column;
  sortDirection.value = "asc";
}

function sortIndicator(column: SortColumn) {
  if (sortColumn.value !== column) return "";
  return sortDirection.value === "asc" ? " ↑" : " ↓";
}

async function requestDelete(user: AdminUser) {
  pendingDelete.value = user;
}

function cancelDelete() {
  if (deleting.value) {
    return;
  }
  pendingDelete.value = null;
}

async function executeDelete() {
  if (!pendingDelete.value || deleting.value) {
    return;
  }

  const userId = pendingDelete.value.id;
  deleting.value = true;
  try {
    const deleted = await admin.deleteUser(userId);
    if (deleted) {
      pendingDelete.value = null;
    }
  } finally {
    deleting.value = false;
  }
}

const deleteMessage = computed(() => {
  if (!pendingDelete.value) {
    return "";
  }
  const label = pendingDelete.value.displayName || pendingDelete.value.email;
  return `Delete ${label}? They will lose access to their account.`;
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar">
      <input v-model="query" type="search" placeholder="Search users, email, ID" />
      <select v-model="userType">
        <option value="all">All users</option>
        <option value="artist">DJ / artist</option>
        <option value="normal">Normal users</option>
        <option value="admin">Admins</option>
      </select>
      <label class="check-row">
        <input v-model="showDeleted" type="checkbox" />
        Show deleted
      </label>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <h2>User Management</h2>
        <span>{{ sortedUsers.length }} users</span>
      </div>
      <div class="table-wrap">
        <table class="user-table">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>
                <button type="button" class="sort-button" @click="toggleSort('user')">
                  User{{ sortIndicator("user") }}
                </button>
              </th>
              <th>
                <button type="button" class="sort-button" @click="toggleSort('role')">
                  Role{{ sortIndicator("role") }}
                </button>
              </th>
              <th>
                <button type="button" class="sort-button" @click="toggleSort('verified')">
                  Verified{{ sortIndicator("verified") }}
                </button>
              </th>
              <th>
                <button type="button" class="sort-button" @click="toggleSort('requests')">
                  Requests{{ sortIndicator("requests") }}
                </button>
              </th>
              <th>
                <button type="button" class="sort-button" @click="toggleSort('paid')">
                  Paid{{ sortIndicator("paid") }}
                </button>
              </th>
              <th>
                <button type="button" class="sort-button" @click="toggleSort('status')">
                  Status{{ sortIndicator("status") }}
                </button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in sortedUsers" :key="user.id">
              <td>
                <strong>{{ user.displayName }}</strong>
                <small>{{ user.email }}</small>
              </td>
              <td>
                <span class="status">{{ roleLabels[user.role] }}</span>
              </td>
              <td>
                <button
                  class="pill-button"
                  type="button"
                  @click="admin.updateUser(user.id, { isEmailVerified: !user.isEmailVerified })"
                >
                  {{ user.isEmailVerified ? "Verified" : "Unverified" }}
                </button>
              </td>
              <td>{{ user.requestCount }}</td>
              <td>${{ (user.paymentTotalCents / 100).toFixed(2) }}</td>
              <td>
                <span class="status" :class="{ bad: user.deletedAt }">{{ user.deletedAt ? "Deleted" : "Active" }}</span>
              </td>
              <td class="user-table-actions">
                <button
                  v-if="!user.deletedAt"
                  class="danger-button"
                  type="button"
                  :disabled="deleting && pendingDelete?.id === user.id"
                  @click.stop="requestDelete(user)"
                >
                  Delete
                </button>
                <button
                  v-else
                  class="secondary-button"
                  type="button"
                  @click.stop="admin.restoreUser(user.id)"
                >
                  Restore
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="pendingDelete"
        class="confirm-backdrop"
        role="presentation"
        @click.self="cancelDelete"
      >
        <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title">
          <h3 id="delete-user-title">Delete user?</h3>
          <p>{{ deleteMessage }}</p>
          <div class="confirm-actions">
            <button class="secondary-button" type="button" :disabled="deleting" @click="cancelDelete">
              Cancel
            </button>
            <button class="danger-button" type="button" :disabled="deleting" @click="executeDelete">
              {{ deleting ? "Deleting..." : "Delete user" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
