import * as aliases from './toast-aliases';

export function AliasReader() {
  return (
    <p data-testid="alias-reader">
      {aliases.GAP_ALIAS}/{aliases.LIMIT_ALIAS}
    </p>
  );
}
