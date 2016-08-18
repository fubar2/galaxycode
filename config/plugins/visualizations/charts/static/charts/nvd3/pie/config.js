define( [ 'plugin/charts/nvd3/common/config', 'plugin/charts/forms/inputs' ], function( nvd3_config, Inputs ) {
    return $.extend(true, {}, {
        title       : 'Pie chart',
        category    : 'Area charts',
        library     : 'NVD3',
        tag         : 'svg',
        keywords    : 'small',
        columns : {
            label : {
                title       : 'Labels',
                is_label    : true,
                is_auto     : true
            },
            y : {
                title       : 'Values',
                is_numeric  : true
            }
        },
        settings : {
            donut_ratio : {
                name        : 'donut_ratio',
                label       : 'Donut ratio',
                help        : 'Determine how large the donut hole will be.',
                type        : 'float',
                value       : 0.5,
                max         : 1,
                min         : 0.0
            },
            show_legend : Inputs.boolean( 'show_legend', { label: 'Show legend', help: 'Would you like to add a legend?', value: 'false' } ),
            label_type  : {
                type        : 'conditional',
                name        : 'label_type'
                test_param  : {
                    name        : 'type',
                    label       : 'Donut label',
                    type        : 'select',
                    value       : 'percent',
                    help        : 'What would you like to show for each slice?',
                    data        : [ { value : 'hide',    label : '-- Nothing --' },
                                    { value : 'key',     label : 'Label column' },
                                    { value : 'percent', label : 'Percentage' } ]
                },
                cases       : [ { value   : 'hide' },
                                { value   : 'key',     inputs: [ { name     : 'label_outside',
                                                                   label    : 'Show outside',
                                                                   help     : 'Would you like to show labels outside the donut?',
                                                                   type     : 'select',
                                                                   display  : 'radiobutton',
                                                                   value    : 'true',
                                                                   data     : [ { label : 'Yes', value : 'true'  },
                                                                                { label : 'No',  value : 'false' } ] } ] },
                                { value   : 'percent', inputs: [ { name     : 'label_outside',
                                                                   label    : 'Show outside',
                                                                   help     : 'Would you like to show labels outside the donut?',
                                                                   type     : 'select',
                                                                   display  : 'radiobutton',
                                                                   value    : 'true',
                                                                   data     : [ { label : 'Yes', value : 'true'  },
                                                                                { label : 'No',  value : 'false' } ] } ] } ]
            },
            use_panels : {
                name        : 'use_panels',
                value       : 'true',
                hidden      : true
            }
        }
    });
});