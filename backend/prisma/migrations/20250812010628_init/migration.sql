-- This migration previously attempted to rename port-related indexes BEFORE the ports table
-- was introduced (in a later migration). That ordering caused shadow database failures.
-- It has been converted into a no-op to preserve migration chain consistency.
-- If you still want the new index names, create a NEW migration after the ports creation
-- that performs the rename safely, or adjust future migrations accordingly.

-- NO-OP
