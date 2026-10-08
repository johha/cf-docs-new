import React from 'react';
// Renders a variable whose value contains HTML markup (migrated from the
// legacy docs' template_variables.yml) as real HTML rather than escaped text.
export default function Html({html}) {
  return <span dangerouslySetInnerHTML={{__html: html}} />;
}
