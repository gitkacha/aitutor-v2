import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { IdentityProvider } from './identity-provider';

// Local password provider: bcrypt against User.passwordHash. Users provisioned by an
// external IdP have no passwordHash and can never log in through this provider.
export const localProvider: IdentityProvider = {
  async verifyCredentials(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.authProvider !== 'local' || !user.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? { userId: user.id } : null;
  },
};
