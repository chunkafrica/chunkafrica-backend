export interface AuthUser {
  userId: string;
  businessId: string;
  roleNames: string[];
  primaryStoreId?: string | null;
}