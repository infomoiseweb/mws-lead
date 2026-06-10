import type { Service } from '../types';

// The "base" service holds the fields shared/inherited by every other service.
// Detection covers old data saved before this was an editable, named service.
export function isBaseService(service: Pick<Service, 'id' | 'name' | 'is_base'> | null | undefined): boolean {
    if (!service) return false;
    return service.is_base === true || service.id === 'service_default_fields' || service.name === '__default_fields__';
}
