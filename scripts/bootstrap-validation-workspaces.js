const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const snackit = {
  business: {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Snackit Validation Workspace",
    currencyCode: "NGN",
    timezone: "Africa/Lagos",
  },
  role: {
    id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    name: "admin",
    description: "Administrator role for Snackit validation access",
  },
  store: {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Snackit Validation Store",
  },
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    fullName: "Snackit Validation User",
    email: "validation@chunk.local",
  },
};

const perfectFabric = {
  business: {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Perfect Fabric Workspace",
    currencyCode: "NGN",
    timezone: "Africa/Lagos",
  },
  role: {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    name: "admin",
    description: "Administrator role for fashion validation access",
  },
  store: {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Perfect Fabric Main Studio",
    address: "18B Acme Road, Ikeja, Lagos",
  },
  user: {
    id: "66666666-6666-6666-6666-666666666666",
    fullName: "Perfect Fabric Validation User",
    email: "fashion.validation@chunk.local",
  },
};

async function upsertValidationWorkspace(workspace) {
  const business = await prisma.business.upsert({
    where: { id: workspace.business.id },
    update: {
      name: workspace.business.name,
      currencyCode: workspace.business.currencyCode,
      timezone: workspace.business.timezone,
      deletedAt: null,
    },
    create: {
      id: workspace.business.id,
      name: workspace.business.name,
      currencyCode: workspace.business.currencyCode,
      timezone: workspace.business.timezone,
    },
  });

  const role = await prisma.role.upsert({
    where: { id: workspace.role.id },
    update: {
      businessId: business.id,
      name: workspace.role.name,
      description: workspace.role.description,
      isSystemRole: true,
      deletedAt: null,
    },
    create: {
      id: workspace.role.id,
      businessId: business.id,
      name: workspace.role.name,
      description: workspace.role.description,
      isSystemRole: true,
    },
  });

  const store = await prisma.store.upsert({
    where: { id: workspace.store.id },
    update: {
      businessId: business.id,
      name: workspace.store.name,
      storeType: "PHYSICAL",
      address: workspace.store.address ?? null,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: workspace.store.id,
      businessId: business.id,
      name: workspace.store.name,
      storeType: "PHYSICAL",
      address: workspace.store.address ?? null,
    },
  });

  const user = await prisma.user.upsert({
    where: { id: workspace.user.id },
    update: {
      businessId: business.id,
      roleId: role.id,
      primaryStoreId: store.id,
      fullName: workspace.user.fullName,
      email: workspace.user.email,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: workspace.user.id,
      businessId: business.id,
      roleId: role.id,
      primaryStoreId: store.id,
      fullName: workspace.user.fullName,
      email: workspace.user.email,
    },
  });

  return { business, role, store, user };
}

async function main() {
  const snackitResult = await upsertValidationWorkspace(snackit);
  const fashionResult = await upsertValidationWorkspace(perfectFabric);

  console.log("Snackit validation workspace ready:", {
    businessId: snackitResult.business.id,
    storeId: snackitResult.store.id,
    userId: snackitResult.user.id,
    userEmail: snackitResult.user.email,
  });
  console.log("Perfect Fabric validation workspace ready:", {
    businessId: fashionResult.business.id,
    storeId: fashionResult.store.id,
    userId: fashionResult.user.id,
    userEmail: fashionResult.user.email,
  });
}

main()
  .catch((error) => {
    console.error("Validation workspace bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
